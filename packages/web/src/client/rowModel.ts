import type { TestNode, TestStatus } from '@reporters/tree-core';

// Worst-first for a container's rollup. `passed` outranks `todo`/`skipped` so a
// suite with passes and a few skips reads green; skipped/todo only win when
// nothing ran. `queued` stays above `passed` — an incomplete container isn't done.
const SEVERITY: TestStatus[] = ['failed', 'running', 'queued', 'passed', 'todo', 'skipped'];

function basename(file: string | undefined): string {
  if (!file) return '<unknown>';
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || file;
}

export function displayName(node: TestNode): string {
  return node.type === 'file' ? basename(node.file) : node.name;
}

export function isContainer(node: TestNode): boolean {
  return node.children.length > 0;
}

/**
 * A node's displayed duration: the measured wall-clock when the runner
 * reported one (a test/suite's own duration_ms, or the file wrapper's), else
 * the sum of its children. Concurrent children overlap, so summing is only a
 * fallback — a 40-minute run of concurrent files sums to many hours.
 */
export function nodeDuration(node: TestNode): number {
  if (node.durationMs != null) return node.durationMs;
  if (!isContainer(node)) return 0;
  return node.children.reduce((total, child) => total + nodeDuration(child), 0);
}

/**
 * The client's fix on the stream's clock: `lastT` is the newest writer stamp
 * seen, `receivedAt` the client clock (performance.now) when it arrived. The
 * pair projects the writer's "now" between polls, so live counters tick
 * smoothly yet always measure writer-stamp against writer-stamp — a viewer
 * that joins (or reloads) mid-run still shows true elapsed times.
 */
export interface LiveClock {
  lastT: number;
  receivedAt: number;
}

/**
 * A descendant that would count toward a duration (running, or measured) but
 * carries no stamp — a mixed old/new-writer log. A span would silently drop
 * it, so its container must fall back to summing instead.
 */
function hasUnstampedContributor(node: TestNode): boolean {
  if (node.startedAt == null && !isContainer(node)
    && (node.status === 'running' || node.durationMs != null)) return true;
  return node.children.some(hasUnstampedContributor);
}

/**
 * Wall-clock span of a stamped subtree: earliest descendant start to latest
 * descendant end, where a still-running descendant ends at the projected
 * stream "now". Null when nothing in the subtree carries a stamp.
 */
function stampedSpan(node: TestNode, streamNow: number): { start: number; end: number } | null {
  let span: { start: number; end: number } | null = null;
  const fold = (start: number, end: number) => {
    if (!span) span = { start, end };
    else {
      span.start = Math.min(span.start, start);
      span.end = Math.max(span.end, end);
    }
  };
  if (node.startedAt != null) {
    const end = node.status === 'running' ? streamNow
      : node.durationMs != null ? node.startedAt + node.durationMs : node.startedAt;
    fold(node.startedAt, end);
  }
  for (const child of node.children) {
    const s = stampedSpan(child, streamNow);
    if (s) fold(s.start, s.end);
  }
  return span;
}

/**
 * Like `nodeDuration`, but live: a running leaf measures from its own start
 * stamp against the projected stream "now", and an unmeasured container spans
 * its stamped descendants' wall-clock instead of summing them (concurrent
 * children overlap — 80 running tests summed would tick 80× real time).
 * Stamp-less streams (older writers) fall back to anchoring on when the client
 * first saw each leaf running (`since`) and summing unmeasured containers.
 */
export function liveNodeDuration(
  node: TestNode,
  now: number,
  since: Map<string, number>,
  clock?: LiveClock | null,
): number {
  const streamNow = clock ? clock.lastT + (now - clock.receivedAt) : null;
  if (!isContainer(node) && node.status === 'running') {
    if (streamNow != null && node.startedAt != null) return Math.max(0, streamNow - node.startedAt);
    if (!since.has(node.key)) since.set(node.key, now); // first sight: start the clock
    return Math.max(0, now - since.get(node.key)!);
  }
  if (node.durationMs != null) return node.durationMs;
  if (!isContainer(node)) return 0;
  if (streamNow != null && !hasUnstampedContributor(node)) {
    const span = stampedSpan(node, streamNow);
    if (span) return Math.max(0, span.end - span.start);
  }
  return node.children.reduce((total, child) => total + liveNodeDuration(child, now, since, clock), 0);
}

/** Container status = the worst status among descendants (severity order). */
export function rollup(node: TestNode): TestStatus {
  if (!isContainer(node)) return node.status;
  for (const s of SEVERITY) if (node.counts[s] > 0) return s;
  return 'passed';
}

export { isPassingTodo } from '@reporters/tree-core';

export function reasonOf(node: TestNode): string | undefined {
  if (typeof node.skip === 'string') return node.skip;
  if (typeof node.todo === 'string') return node.todo;
  return undefined;
}

/** Node's aggregate "N subtests failed" error — redundant with the real error on
 *  the failing leaf, so we never render it. */
const SYNTHETIC_ROLLUP = /^\d+ subtests? failed$/i;

/**
 * The error worth showing: only a *leaf* test's own error, and never Node's
 * synthetic container rollup. Containers communicate failure through their
 * status glyph and the failed child inside them, not an error block.
 */
export function realError(node: TestNode): { message: string; stack?: string } | undefined {
  if (isContainer(node) || !node.error) return undefined;
  if (SYNTHETIC_ROLLUP.test((node.error.message ?? '').trim())) return undefined;
  return node.error;
}

export function hasDiagnostics(node: TestNode): boolean {
  return Boolean(realError(node))
    || node.diagnostics.length > 0
    || node.stdout.length > 0
    || node.stderr.length > 0
    || Boolean(reasonOf(node));
}

function defaultExpanded(node: TestNode): boolean {
  const { counts } = node;
  if (node.type === 'file') return !(counts.total > 0 && counts.queued === counts.total);
  // Failures surface with zero clicks: a failed node (leaf or both-node) opens,
  // as does anything with a failed/running descendant.
  return node.status === 'failed' || counts.failed > 0 || counts.running > 0;
}

export interface FlatRow {
  node: TestNode;
  depth: number;
  status: TestStatus;
  /** 'node' = a file/suite/test row; 'output' = its nested own-output panel slot. */
  kind: 'node' | 'output';
  /** The row has a region to reveal: children and/or its own output. */
  expandable: boolean;
  expanded: boolean;
  /** Node rows: the node carries its own output (drives the passive badge). */
  hasDiag: boolean;
}

export interface Matches {
  visible: Set<string>;
  force: Set<string>;
}

/**
 * Which nodes stay visible under the active filters. The text query and the
 * status set compose as AND on leaves: a leaf matches when its own (or an
 * ancestor's) name contains the query and its status is in the set. Ancestors
 * of a match stay visible for path context and are force-expanded so the
 * match is actually on screen; a leaf that only inherited its ancestor's name
 * match doesn't force anything open.
 */
export function computeMatches(files: TestNode[], query: string, statuses: ReadonlySet<TestStatus> = new Set()): Matches {
  const visible = new Set<string>();
  const force = new Set<string>();
  const statusOk = (node: TestNode): boolean => statuses.size === 0 || statuses.has(node.status);
  const walk = (node: TestNode, ancestors: string[], inheritedText: boolean): { vis: boolean; own: boolean } => {
    const selfText = query !== '' && displayName(node).toLowerCase().includes(query);
    const textOk = query === '' || selfText || inheritedText;
    let descVis = false;
    let descOwn = false;
    for (const child of node.children) {
      const r = walk(child, [...ancestors, node.key], textOk);
      descVis ||= r.vis;
      descOwn ||= r.own;
    }
    const leafMatch = node.children.length === 0 && textOk && statusOk(node);
    if (leafMatch || descVis) {
      visible.add(node.key);
      for (const a of ancestors) visible.add(a);
    }
    // Expand the path to nodes matched in their own right (a name hit, or a
    // status hit under an active status filter) — not to leaves merely swept
    // in by a container's name match.
    if (descOwn) force.add(node.key);
    const own = selfText || (leafMatch && statuses.size > 0) || descOwn;
    return { vis: leafMatch || descVis, own };
  };
  for (const file of files) walk(file, [], false);
  return { visible, force };
}

export interface BuildOptions {
  overrides: Map<string, boolean>;
  query: string;
  statuses?: ReadonlySet<TestStatus>;
  matches: Matches | null;
}

function filtering(opts: BuildOptions): boolean {
  return opts.query !== '' || (opts.statuses?.size ?? 0) > 0;
}

export function isExpanded(node: TestNode, opts: BuildOptions): boolean {
  if (filtering(opts) && opts.matches?.force.has(node.key)) return true;
  const { overrides } = opts;
  return overrides.has(node.key) ? overrides.get(node.key)! : defaultExpanded(node);
}

/** Open state of one panel section inside a node's output region. Error opens
 *  by default (failures surface with zero clicks) and so does the one-line
 *  skip/todo reason; heavy Output/Diagnostics need a deliberate click. */
export function isSectionOpen(node: TestNode, blockKey: string, overrides: Map<string, boolean>): boolean {
  const key = `${node.key}::diag:${blockKey}`;
  if (overrides.has(key)) return overrides.get(key)!;
  return blockKey === 'error' || blockKey === 'reason';
}

// One disclosure per row: expanding a node reveals ONE region holding its own
// output (boxed panel sections, never tree rows) followed by its child rows.
// A pure leaf reveals only its output; a pure container only children; a
// both-node reveals output then children.
export function buildRows(files: TestNode[], opts: BuildOptions): FlatRow[] {
  const rows: FlatRow[] = [];
  const push = (node: TestNode, depth: number): void => {
    if (filtering(opts) && !opts.matches!.visible.has(node.key)) return;
    const diag = hasDiagnostics(node);
    const expandable = isContainer(node) || diag;
    const expanded = expandable && isExpanded(node, opts);
    const status = rollup(node);
    rows.push({
      node, depth, status, kind: 'node', expandable, expanded, hasDiag: diag,
    });
    if (!expanded) return;
    if (diag) {
      rows.push({
        node, depth: depth + 1, status, kind: 'output', expandable: false, expanded: false, hasDiag: true,
      });
    }
    for (const child of node.children) push(child, depth + 1);
  };
  for (const file of files) push(file, 0);
  return rows;
}

/** Keys of every expandable row — containers plus nodes with their own output. */
export function collectContainerKeys(nodes: TestNode[], into: string[]): void {
  for (const node of nodes) {
    if (isContainer(node) || hasDiagnostics(node)) into.push(node.key);
    collectContainerKeys(node.children, into);
  }
}
