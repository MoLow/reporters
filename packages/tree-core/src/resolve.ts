import type { TestEventData } from './types.ts';
import {
  basename, REPL, SEP, TERMINAL, type InternalNode,
} from './internal.ts';

/** The node-graph primitives a resolver needs; all owned by the store. */
export interface ResolverContext {
  nodes: Map<string, InternalNode>;
  /** The absolute spelling of a path the runner reported CLI-relative. */
  aliasFile(file: string | undefined): string | undefined;
  /** The file-group node this event belongs to, created if new. */
  group(data: TestEventData): InternalNode;
  instancesFor(gk: string, testId: number): InternalNode[];
  createInstance(gk: string, testId: number, data: TestEventData): InternalNode;
  /** Most recent node seen at (group, nesting). */
  lastAtGroupNesting(gk: string, nesting: number): string | undefined;
  /** Most recent still-open node at a nesting, in any group. */
  lastOpenAtNesting(nesting: number): string | undefined;
}

/**
 * Every decision about which node an event belongs to and where it hangs.
 *
 * Two implementations, deliberately kept side by side so they can be read
 * against each other: the exact one, used once a stream is seen to carry
 * `entryFile`, and the heuristic one for every stream that does not.
 */
export interface Resolver {
  /** The file a group is named for — the entry file when the stream says so. */
  groupFile(data: TestEventData): string | undefined;
  /** The file-group key an event belongs to. */
  groupKey(data: TestEventData): string;
  /** A parent-emitted file wrapper: marks isolation, but is not a real test. */
  isFileLevel(data: TestEventData): boolean;
  /** Which declaration stack this event's report order belongs to. */
  declBucket(data: TestEventData): string;
  /** The instance an execution-ordered event refers to, creating it if new. */
  instance(data: TestEventData, gk: string): InternalNode;
  /** Where an execution-ordered event's node hangs. Provisional. */
  parentKey(data: TestEventData, gk: string): string;
  /** Where a declaration-ordered start's node hangs. Authoritative. */
  declParentKey(data: TestEventData, gk: string, enclosing: InternalNode | undefined): string;
}

const ONE_STACK = `${SEP}decl`;

export function groupKeyFor(file: string | undefined): string {
  return `${SEP}file${SEP}${file ?? REPL}`;
}

/**
 * For streams without `entryFile` — Node < v26.6.0, or any run without process
 * isolation. Groups by the reported file, which for a test defined in a shared
 * imported helper is that helper rather than the entry file; so under process
 * isolation the same helper run from two files merges and their per-process
 * testIds collide. Everything heuristic lives here.
 */
export function createLegacyResolver(ctx: ResolverContext): Resolver {
  // A subtest defined in a shared helper reports the helper as its `file`, so
  // its parentId points at a test in ANOTHER group. Candidates are the
  // still-open (non-terminal) nodes with that testId: under process isolation
  // testIds collide across files, and only a still-open candidate can be the
  // real parent — a collided one from a file that already finished cannot. A
  // real parent always sits one nesting level above its child, so when any
  // candidate matches that, the ones that don't are ruled out.
  function findOpenParents(parentId: number, childNesting: number | undefined): InternalNode[] {
    const open: InternalNode[] = [];
    for (const node of ctx.nodes.values()) {
      if (node.testId !== parentId || TERMINAL.has(node.status)) continue;
      if (node.type !== 'test' && node.type !== 'suite') continue;
      open.push(node);
    }
    if (childNesting != null) {
      const exact = open.filter((n) => n.nesting === childNesting - 1);
      if (exact.length > 0) return exact;
    }
    return open;
  }

  return {
    groupFile(data) {
      return ctx.aliasFile(data.file);
    },

    groupKey(data) {
      return groupKeyFor(this.groupFile(data));
    },

    // Matched on basename because the wrapper's relative `name` and absolute
    // `file` only reliably agree on the last segment, and paths can't be
    // resolved in the browser (the store runs there too).
    isFileLevel(data) {
      if (data.nesting !== 0 || data.name == null || data.file == null) return false;
      return basename(data.name) === basename(data.file);
    },

    // The declaration-ordered events are one depth-first traversal of the real
    // tree serialized across the whole run, so a single stack resolves every
    // parent — including helper-file subtests whose parentId is ambiguous.
    declBucket() {
      return ONE_STACK;
    },

    // Route to the instance the event belongs to: same name (or a still-unnamed
    // placeholder), preferring one still open. Identically named twins from
    // colliding processes may share an instance here — their declaration-ordered
    // starts split them later.
    instance(data, gk) {
      const named = ctx.instancesFor(gk, data.testId!)
        .filter((n) => data.name == null || n.name === '' || n.name === data.name);
      const open = named.filter((n) => !TERMINAL.has(n.status));
      const node = open[open.length - 1] ?? named[named.length - 1];
      return node ?? ctx.createInstance(gk, data.testId!, data);
    },

    parentKey(data, gk) {
      const group = ctx.group(data);
      // parentId is the in-process testId of the enclosing test; 0 is the root.
      if (data.parentId != null) {
        if (data.parentId === 0) return group.key;
        const local = ctx.instancesFor(gk, data.parentId).filter((n) => !TERMINAL.has(n.status)).pop();
        if (local) return local.key;
        const candidates = findOpenParents(data.parentId, data.nesting);
        if (candidates.length === 1) return candidates[0].key;
        // Several concurrent processes have an open test with this id — the
        // event doesn't say which one is the parent, so don't guess: park under
        // the helper group. A later event re-resolves once the collision clears,
        // and the declaration-ordered block settles it for good.
        if (candidates.length > 1) return group.key;
        return ctx.createInstance(gk, data.parentId, data).key;
      }
      // Fallback for Node builds that don't emit parentId: use the nesting stack.
      const nesting = data.nesting ?? 0;
      if (nesting > 0) {
        const ancestor = ctx.lastAtGroupNesting(gk, nesting - 1);
        if (ancestor) return ancestor;
        const crossGroup = ctx.lastOpenAtNesting(nesting - 1);
        if (crossGroup) return crossGroup;
      }
      return group.key;
    },

    // A same-group parent that was itself declaration-placed is exact (and
    // tolerates decl streams that interleave across files); otherwise the
    // enclosing open declaration node one level up is the parent — that is what
    // report order means.
    declParentKey(data, gk, enclosing) {
      if (data.parentId != null && data.parentId !== 0) {
        const local = ctx.instancesFor(gk, data.parentId)
          .filter((n) => n.declPlaced && !TERMINAL.has(n.status)).pop();
        if (local) return local.key;
      }
      if (enclosing && (data.parentId == null || enclosing.testId === data.parentId)) return enclosing.key;
      return this.parentKey(data, gk);
    },
  };
}

/**
 * For streams whose events carry `entryFile` (process isolation on Node >=
 * v26.6.0). `entryFile` names the child process that produced the event, and
 * testIds are unique within one process, so `(entryFile, testId)` identifies a
 * test exactly. Nothing here searches, guesses or parks.
 */
export function createExactResolver(ctx: ResolverContext): Resolver {
  return {
    // Child-forwarded events carry the entry file directly; the parent's own
    // file-wrapper events report it as `file`.
    groupFile(data) {
      return data.entryFile ?? ctx.aliasFile(data.file);
    },

    // Grouping by the entry file puts a helper-defined test under the file that
    // ran it, and makes the CLI-relative/absolute mismatch on test:stdout moot.
    groupKey(data) {
      return groupKeyFor(this.groupFile(data));
    },

    // A wrapper is emitted by the parent runner, which never stamps entryFile,
    // so its absence is what identifies one. That is exact, where the basename
    // match alone would misread a test named after its own file.
    isFileLevel(data) {
      if (data.entryFile != null) return false;
      if (data.nesting !== 0 || data.name == null || data.file == null) return false;
      return basename(data.name) === basename(data.file);
    },

    // Each process reports its own declaration order, so each entry file gets
    // its own stack and interleaving across files cannot confuse them.
    declBucket(data) {
      return this.groupFile(data) ?? REPL;
    },

    // testIds are unique per process and the group IS the process, so there is
    // exactly one instance per (group, testId) — no splitting, no name matching.
    instance(data, gk) {
      return ctx.instancesFor(gk, data.testId!)[0] ?? ctx.createInstance(gk, data.testId!, data);
    },

    parentKey(data, gk) {
      if (data.parentId == null || data.parentId === 0) return ctx.group(data).key;
      const local = ctx.instancesFor(gk, data.parentId)[0];
      if (local) return local.key;
      // The parent's own events have not arrived yet; a placeholder under the
      // same (entryFile, parentId) is exactly what they will land on.
      return ctx.createInstance(gk, data.parentId, data).key;
    },

    // parentId is unambiguous here, so it decides. The enclosing declaration
    // node only matters for a top-level test in a build that omits parentId.
    declParentKey(data, gk, enclosing) {
      if (data.parentId != null && data.parentId !== 0) return this.parentKey(data, gk);
      if (data.parentId == null && enclosing) return enclosing.key;
      return ctx.group(data).key;
    },
  };
}
