import type {
  Counts,
  DiagnosticLevel,
  SerializedError,
  SummaryData,
  TestEvent,
  TestEventData,
  TestMessage,
  TestNode,
  TestStatus,
  TreeSnapshot,
  TreeStore,
} from './types.ts';
import {
  makeNode, REPL, ROOT_KEY, SEP, TERMINAL, type InternalNode,
} from './internal.ts';
import {
  createExactResolver, createLegacyResolver, type Resolver, type ResolverContext,
} from './resolve.ts';

// A todo test that actually passes reports as passed (its `todo` marker is
// kept on the node); `todo` status is reserved for todos that are failing
// underneath — the expected state, which must not fail the run.
function statusFromResult(type: 'pass' | 'fail', data: TestEventData): TestStatus {
  if (data.skip != null && data.skip !== false) return 'skipped';
  if (data.todo != null && data.todo !== false) return type === 'pass' ? 'passed' : 'todo';
  return type === 'pass' ? 'passed' : 'failed';
}

function statusFromComplete(data: TestEventData): TestStatus {
  if (data.skip != null && data.skip !== false) return 'skipped';
  if (data.todo != null && data.todo !== false) return data.details?.passed ? 'passed' : 'todo';
  return data.details?.passed ? 'passed' : 'failed';
}

const LEVELS: ReadonlySet<string> = new Set(['info', 'warn', 'error']);

// `test:log` carries no level of its own — the runner passes the payload through
// untouched — so a level is a reporter-side convention read out of it.
function logLevel(data: TestEventData): DiagnosticLevel {
  const level = (data.data as { level?: unknown } | null | undefined)?.level;
  return typeof level === 'string' && LEVELS.has(level) ? level as DiagnosticLevel : 'info';
}

function serializeError(raw: unknown): SerializedError | undefined {
  if (raw == null) return undefined;
  const err = raw as { message?: string; stack?: string; name?: string; cause?: unknown };
  const cause = (err.cause ?? err) as { message?: string; stack?: string; name?: string };
  // A cause whose message/name live on prototype getters (e.g. DOMException) loses them
  // when v8-serialized across the test-runner IPC boundary; the stack string keeps the
  // real "Name: message" first line, so fall back to it before the generic String().
  return {
    message: cause?.message || cause?.stack?.split('\n', 1)[0] || String(cause),
    stack: cause?.stack,
    name: cause?.name,
  };
}

export function createTreeStore(): TreeStore {
  const nodes = new Map<string, InternalNode>();
  const listeners = new Set<() => void>();
  // testId is only unique within a file's process; under `--test` isolation the
  // same (file, testId) pair can name several distinct tests when a shared
  // helper file is exercised by concurrent processes. Each such test is its own
  // instance under the (group, testId) base key.
  const instancesByBase = new Map<string, string[]>();
  // Currently-open declaration nodes by nesting, per declaration stack. The
  // resolver decides how many stacks there are: one shared stack when the
  // stream gives no way to tell processes apart, one per entry file when it
  // does.
  const declOpenByBucket = new Map<string, Map<number, string>>();
  const lastStartedByGroupNesting = new Map<string, Map<number, string>>();
  const lastByGroupNesting = new Map<string, Map<number, string>>();
  // State for the testId-free path (Node builds that don't emit testId, e.g. v22):
  const openByGroupNesting = new Map<string, Map<number, string>>();
  const pendingByGroupNesting = new Map<string, Map<number, string[]>>();
  // Cross-group recency, for Node builds that don't emit parentId (v22/v24):
  // a helper-defined subtest groups under the helper file, where the nesting
  // stack has no ancestor — its parent is the most recently seen, still-open
  // node one level up, whichever group that node lives in.
  const lastByNesting = new Map<number, string>();
  // Node reports test:stdout/test:stderr with the CLI-relative file path, but
  // test lifecycle events report the resolved absolute path. The file-level
  // wrapper carries both (its `name` is the relative path, its `file` the
  // absolute one), so we learn the mapping there and canonicalize in groupKey —
  // otherwise a file's output splits into its own node, separate from its tests.
  const fileAlias = new Map<string, string>();
  let autoId = 0;
  let sawFileWrapper = false;
  let summary: SummaryData | undefined;
  let runAttempt: number | undefined;
  // Wall-clock stamps from the writer (`event.t`). `currentT` is the stamp of
  // the event being applied, so the helpers that mark a node running can record
  // when it actually started without threading it through every signature.
  let firstT: number | undefined;
  let lastT: number | undefined;
  let currentT: number | undefined;
  let dirty = true;
  let version = 0;
  let cached: TreeSnapshot | null = null;

  const root: InternalNode = makeNode(ROOT_KEY, 'root');
  root.nesting = -1;
  root.status = 'running';
  nodes.set(ROOT_KEY, root);

  function link(child: InternalNode, parentKey: string): void {
    if (child.parentKey === parentKey) return;
    if (child.parentKey != null) {
      const old = nodes.get(child.parentKey);
      if (old) old.childKeys = old.childKeys.filter((k) => k !== child.key);
    }
    const parent = nodes.get(parentKey);
    if (parent && !parent.childKeys.includes(child.key)) parent.childKeys.push(child.key);
    child.parentKey = parentKey;
  }

  function ensureGroupNode(key: string, file: string | undefined): InternalNode {
    let node = nodes.get(key);
    if (!node) {
      node = makeNode(key, 'file');
      node.file = file;
      node.name = file ?? REPL;
      nodes.set(key, node);
      link(node, ROOT_KEY);
    }
    return node;
  }

  function baseKey(gk: string, testId: number): string {
    return `${gk}${SEP}#${testId}`;
  }

  function findOpenAtNesting(nesting: number): string | undefined {
    const key = lastByNesting.get(nesting);
    const node = key ? nodes.get(key) : undefined;
    return node && !TERMINAL.has(node.status) ? node.key : undefined;
  }

  const ctx: ResolverContext = {
    nodes,
    aliasFile(file) {
      return file != null ? (fileAlias.get(file) ?? file) : undefined;
    },
    group(data) {
      return ensureGroupNode(resolver.groupKey(data), resolver.groupFile(data));
    },
    instancesFor(gk, testId) {
      return (instancesByBase.get(baseKey(gk, testId)) ?? []).map((key) => nodes.get(key)!);
    },
    createInstance(gk, testId, data) {
      const base = baseKey(gk, testId);
      const list = instancesByBase.get(base) ?? [];
      const key = list.length === 0 ? base : `${base}${SEP}~${list.length}`;
      const node = makeNode(key, 'test');
      node.testId = testId;
      // The definition site, which for a helper-defined test is not the file
      // its group is named for.
      node.file = data.file;
      nodes.set(key, node);
      list.push(key);
      instancesByBase.set(base, list);
      link(node, ctx.group(data).key);
      return node;
    },
    lastAtGroupNesting(gk, nesting) {
      return lastByGroupNesting.get(gk)?.get(nesting);
    },
    lastOpenAtNesting: findOpenAtNesting,
  };

  const legacyResolver = createLegacyResolver(ctx);
  const exactResolver = createExactResolver(ctx);
  // Latched, not per-event: the only events preceding the first `entryFile` are
  // the parent's own file wrappers, which both resolvers key off `data.file`
  // identically — so switching mid-stream cannot invalidate what came before.
  let resolver: Resolver = legacyResolver;

  function selectResolver(data: TestEventData): void {
    if (data.entryFile != null) resolver = exactResolver;
  }

  function declOpenOf(data: TestEventData): Map<number, string> {
    const bucket = resolver.declBucket(data);
    let open = declOpenByBucket.get(bucket);
    if (!open) {
      open = new Map<number, string>();
      declOpenByBucket.set(bucket, open);
    }
    return open;
  }

  function assignFields(node: InternalNode, data: TestEventData): void {
    if (data.entryFile != null) node.entryFile = data.entryFile;
    if (data.name != null) node.name = data.name;
    if (data.nesting != null) node.nesting = data.nesting;
    if (data.line != null) node.line = data.line;
    if (data.column != null) node.column = data.column;
    if (data.tags != null) node.tags = data.tags;
    if (data.skip != null) node.skip = data.skip;
    if (data.todo != null) node.todo = data.todo;
    if (data.type === 'suite') node.type = 'suite';
  }

  function upsertFromTestEvent(data: TestEventData, mutate: (node: InternalNode) => void): void {
    const gk = resolver.groupKey(data);
    const node = resolver.instance(data, gk);
    // Execution-ordered placement is provisional (parentId is ambiguous across
    // processes); once the declaration-ordered start has placed the node, its
    // position is settled — never re-link it from an eager event.
    if (!node.declPlaced) {
      const parentKey = resolver.parentKey(data, gk);
      // A late, buffered event (test:pass after the parent finished) can resolve
      // only as far as the group root; never demote a node that already found
      // its real parent.
      const current = node.parentKey ? nodes.get(node.parentKey) : undefined;
      const demotes = parentKey === gk && current && current.type !== 'file' && current.type !== 'root';
      if (!demotes) link(node, parentKey);
    }
    const nestingMap = lastByGroupNesting.get(gk) ?? new Map<number, string>();
    nestingMap.set(data.nesting ?? 0, node.key);
    lastByGroupNesting.set(gk, nestingMap);
    lastByNesting.set(data.nesting ?? 0, node.key);
    assignFields(node, data);
    mutate(node);
  }

  // Declaration starts arrive in declaration order, so a node that decl-starts
  // must sit after every previously decl-placed sibling — an eager mis-link
  // (ambiguous parentId) can otherwise leave it appended out of order once the
  // decl re-link lands. Move it the minimal distance: nodes already past that
  // point, and eager-only siblings (position provisional, no decl anchor yet),
  // stay exactly where they are.
  function placeInDeclOrder(node: InternalNode): void {
    // Callers link() the node first, so a parent always exists.
    const parent = nodes.get(node.parentKey!)!;
    let lastDecl = -1;
    for (let i = 0; i < parent.childKeys.length; i += 1) {
      const key = parent.childKeys[i];
      if (key !== node.key && nodes.get(key)?.declPlaced) lastDecl = i;
    }
    if (parent.childKeys.indexOf(node.key) > lastDecl) return;
    const keys = parent.childKeys.filter((k) => k !== node.key);
    keys.splice(lastDecl, 0, node.key);
    parent.childKeys = keys;
  }

  // A group without a wrapper (a shared helper with top-level tests) is created
  // by whichever process reports first — a wall-clock race. Its first
  // declaration-ordered test settles the group's slot among the root children,
  // the same way declaration starts settle test siblings.
  function settleGroup(parentKey: string): void {
    const parent = nodes.get(parentKey)!;
    if (parent.type !== 'file' || parent.declPlaced) return;
    parent.declPlaced = true;
    placeInDeclOrder(parent);
  }

  function declStart(data: TestEventData): void {
    const gk = resolver.groupKey(data);
    const nesting = data.nesting ?? 0;
    const declOpen = declOpenOf(data);
    const enclosingKey = declOpen.get(nesting - 1);
    const parentKey = resolver.declParentKey(
      data,
      gk,
      enclosingKey ? nodes.get(enclosingKey) : undefined,
    );
    const candidates = ctx.instancesFor(gk, data.testId!)
      .filter((n) => n.name === data.name || n.name === '');
    // Same declaration position again is a replay; otherwise claim the eager
    // instance, or split off a new one when a colliding process already did.
    const settled = candidates.find((n) => n.declPlaced && n.parentKey === parentKey);
    const node = settled
      ?? candidates.find((n) => !n.declPlaced)
      ?? ctx.createInstance(gk, data.testId!, data);
    link(node, parentKey);
    node.declPlaced = true;
    // A replayed start (watch-mode rerun, re-read stream) must not move a
    // settled node — a PARTIAL rerun would shuffle it past its siblings.
    if (!settled) placeInDeclOrder(node);
    settleGroup(node.parentKey!);
    assignFields(node, data);
    if (!TERMINAL.has(node.status)) {
      node.status = 'running';
      node.startedAt ??= currentT;
    }
    declOpen.set(nesting, node.key);
    for (const level of [...declOpen.keys()]) if (level > nesting) declOpen.delete(level);
    const nestingMap = lastByGroupNesting.get(gk) ?? new Map<number, string>();
    nestingMap.set(nesting, node.key);
    lastByGroupNesting.set(gk, nestingMap);
    lastByNesting.set(nesting, node.key);
    recordLastStarted(data, node.key);
  }

  // A finish for a test whose start was never seen (head-truncated log,
  // mid-run attach) still pins its start: the finish stamp minus the measured
  // duration is when it really began. That start is evidence the run was
  // already underway, so it widens the stream's stamp range too — the header
  // must never read less than a row it contains.
  function backdateStart(node: InternalNode, data: TestEventData): void {
    // A carried test's duration is a prior attempt's measurement, not evidence
    // of when this run began.
    if (data.details?.passed_on_attempt != null) return;
    if (node.startedAt == null && currentT != null && data.details?.duration_ms != null) {
      node.startedAt = currentT - data.details.duration_ms;
      if (firstT == null || node.startedAt < firstT) firstT = node.startedAt;
    }
  }

  function noteAttempt(node: InternalNode, data: TestEventData): void {
    if (data.details?.attempt != null) runAttempt = data.details.attempt;
    if (data.details?.passed_on_attempt != null) node.passedOnAttempt = data.details.passed_on_attempt;
  }

  function declFinalize(status: TestStatus, data: TestEventData): void {
    const gk = resolver.groupKey(data);
    const nesting = data.nesting ?? 0;
    const declOpen = declOpenOf(data);
    const openKey = declOpen.get(nesting);
    const openNode = openKey ? nodes.get(openKey) : undefined;
    const matchesOpen = openNode && openNode.testId === data.testId && openNode.name === data.name;
    const node = matchesOpen ? openNode : resolver.instance(data, gk);
    backdateStart(node, data);
    noteAttempt(node, data);
    assignFields(node, data);
    node.status = status;
    if (data.details?.duration_ms != null) node.durationMs = data.details.duration_ms;
    // details.type is the finishing test's own type — authoritative. It can
    // DEMOTE a wrong 'suite': Node dequeues a queued subtest with its parent's
    // type, so a plain test() inside a describe() dequeues as 'suite'.
    if (data.details?.type != null) node.type = data.details.type === 'suite' ? 'suite' : 'test';
    const error = serializeError(data.details?.error);
    if (error) node.error = error;
    for (const level of [...declOpen.keys()]) if (level >= nesting) declOpen.delete(level);
  }

  // ---- testId-free path: build hierarchy from declaration-ordered start /
  // pass / fail events using a per-(group, nesting) stack and FIFO. Both
  // test:start and test:pass/fail are emitted in declaration order, so the
  // k-th start at a nesting pairs with the k-th result at that nesting.
  function stackStart(data: TestEventData): InternalNode {
    const gk = resolver.groupKey(data);
    const group = ctx.group(data);
    const nesting = data.nesting ?? 0;
    const open = openByGroupNesting.get(gk) ?? new Map<number, string>();
    openByGroupNesting.set(gk, open);
    const parentKey = nesting > 0
      ? (open.get(nesting - 1) ?? findOpenAtNesting(nesting - 1) ?? group.key)
      : group.key;

    const key = `${gk}${SEP}#a${autoId++}`;
    const node = makeNode(key, data.type === 'suite' ? 'suite' : 'test');
    node.file = data.file;
    nodes.set(key, node);
    link(node, parentKey);
    settleGroup(node.parentKey!);
    assignFields(node, data);
    node.status = 'running';
    node.startedAt = currentT; // freshly created above — never stamped yet

    open.set(nesting, key);
    lastByNesting.set(nesting, key);
    for (const level of [...open.keys()]) if (level > nesting) open.delete(level);

    const pend = pendingByGroupNesting.get(gk) ?? new Map<number, string[]>();
    pendingByGroupNesting.set(gk, pend);
    const queue = pend.get(nesting) ?? [];
    queue.push(key);
    pend.set(nesting, queue);

    recordLastStarted(data, key);
    return node;
  }

  function stackFinalize(status: TestStatus, data: TestEventData): void {
    const gk = resolver.groupKey(data);
    const nesting = data.nesting ?? 0;
    const key = pendingByGroupNesting.get(gk)?.get(nesting)?.shift();
    let node = key ? nodes.get(key) : undefined;
    if (!node) {
      // No matching open node: this finish IS the first sight of the test, so
      // the start stamp stackStart put on it (the finish event's clock) is a
      // duration too late — backdate it. And the node is finished the moment
      // it's born: take back the pending-queue slot stackStart just pushed,
      // or the NEXT first-sighting finish would merge into this node.
      node = stackStart(data);
      pendingByGroupNesting.get(gk)!.get(nesting)!.pop();
      node.startedAt = undefined;
      backdateStart(node, data);
    }
    noteAttempt(node, data);
    assignFields(node, data);
    node.status = status;
    if (data.details?.duration_ms != null) node.durationMs = data.details.duration_ms;
    if (data.details?.type != null) node.type = data.details.type === 'suite' ? 'suite' : 'test';
    const error = serializeError(data.details?.error);
    if (error) node.error = error;
  }

  function recordLastStarted(data: TestEventData, key: string): void {
    const gk = resolver.groupKey(data);
    const map = lastStartedByGroupNesting.get(gk) ?? new Map<number, string>();
    map.set(data.nesting ?? 0, key);
    lastStartedByGroupNesting.set(gk, map);
  }

  function apply(event: TestEvent): void {
    const { type, data } = event;
    currentT = event.t;
    if (event.t != null) {
      firstT = firstT == null ? event.t : Math.min(firstT, event.t);
      lastT = lastT == null ? event.t : Math.max(lastT, event.t);
    }
    // A stream that stamps entryFile resolves exactly from here on. Latched
    // before anything reads the resolver, so one event never mixes the two.
    selectResolver(data);
    // The wrapper's relative `name` is the spelling stdout/stderr events use for
    // `file`; map it to the resolved absolute path so both group together.
    if (resolver.isFileLevel(data) && data.name !== data.file) fileAlias.set(data.name!, data.file!);
    switch (type) {
      case 'test:enqueue':
      case 'test:dequeue':
        // enqueue/dequeue are emitted EAGERLY (before a concurrent test's
        // reportOrder turn), so they are what makes the live tree show tests as
        // they start — grouped by file, they don't collide across files. The
        // terminal-status guard in upsert keeps this idempotent and lets the
        // later start/pass/fail settle the final state.
        if (resolver.isFileLevel(data)) {
          sawFileWrapper = true;
          // The runner enqueues the file wrappers up front, in the order the
          // files will report. Claim the group slots now so file order doesn't
          // depend on which process happens to emit a test event first. Only
          // the enqueue is that ordered signal — a dequeue seen without its
          // enqueue (mid-run attach) arrives at wall-clock position, and its
          // group must stay unplaced to settle in decl-stream order instead.
          const group = ctx.group(data);
          if (type === 'test:enqueue') group.declPlaced = true;
          else group.wrapperOpen = true;
          break;
        }
        if (data.testId == null) break;
        // Note: don't record "last started" here — enqueue/dequeue are eager, so
        // it would mis-attribute diagnostics. That's recorded on test:start,
        // which arrives in report order alongside diagnostics.
        upsertFromTestEvent(data, (node) => {
          if (TERMINAL.has(node.status)) return;
          node.status = type === 'test:dequeue' ? 'running' : 'queued';
          if (node.status === 'running') node.startedAt ??= currentT;
        });
        break;
      case 'test:start':
        if (resolver.isFileLevel(data)) {
          sawFileWrapper = true;
          declOpenOf(data).clear();
          ctx.group(data).wrapperOpen = true;
          break;
        }
        if (data.testId != null) {
          declStart(data);
        } else {
          stackStart(data);
        }
        break;
      case 'test:complete': {
        // test:complete is emitted in EXECUTION order (as each test finishes),
        // unlike test:pass/fail which are declaration-ordered and buffered. So
        // this is what lets the live tree mark tests done in real time. It
        // carries testId on modern Node; older builds (no testId) fall back to
        // the declaration-ordered pass/fail stack below.
        if (resolver.isFileLevel(data)) {
          sawFileWrapper = true;
          const group = ctx.group(data);
          group.wrapperOpen = false;
          // The wrapper measures the file's real wall-clock — the file's
          // concurrent tests sum to much more than the run actually took.
          if (data.details?.duration_ms != null) group.durationMs = data.details.duration_ms;
          if (data.details?.passed === false) {
            group.wrapperFailed = true;
            group.wrapperError ??= serializeError(data.details.error);
          }
          break;
        }
        if (data.testId == null) break;
        const status = statusFromComplete(data);
        upsertFromTestEvent(data, (node) => {
          backdateStart(node, data);
          noteAttempt(node, data);
          node.status = status;
          if (data.details?.duration_ms != null) node.durationMs = data.details.duration_ms;
          if (data.details?.type != null) node.type = data.details.type === 'suite' ? 'suite' : 'test';
          const error = serializeError(data.details?.error);
          if (error) node.error = error;
        });
        break;
      }
      case 'test:pass':
      case 'test:fail': {
        if (resolver.isFileLevel(data)) {
          sawFileWrapper = true;
          declOpenOf(data).clear();
          const group = ctx.group(data);
          group.wrapperOpen = false;
          if (data.details?.duration_ms != null) {
            group.durationMs = group.durationMs ?? data.details.duration_ms;
          }
          if (type === 'test:fail') {
            group.wrapperFailed = true;
            group.wrapperError ??= serializeError(data.details?.error);
          }
          break;
        }
        const status = statusFromResult(type === 'test:pass' ? 'pass' : 'fail', data);
        if (data.testId != null) {
          declFinalize(status, data);
        } else {
          stackFinalize(status, data);
        }
        break;
      }
      case 'test:log': {
        // Unlike a diagnostic, a log names its own test (testId/parentId), so it
        // routes exactly. It is also execution-ordered and bypasses the per-file
        // declaration buffer, so it can be the first sight of a test — the eager
        // upsert below creates the node when that happens.
        if (data.message == null) break;
        const message: TestMessage = { kind: 'log', message: data.message, level: logLevel(data) };
        if (data.data !== undefined) message.data = data.data;
        if (currentT != null) message.t = currentT;
        if (data.testId == null) {
          ctx.group(data).messages.push(message);
          break;
        }
        upsertFromTestEvent(data, (node) => { node.messages.push(message); });
        break;
      }
      case 'test:diagnostic': {
        if (data.message == null) break;
        const gk = resolver.groupKey(data);
        // Diagnostics are declaration-ordered, so the open declaration node at
        // this nesting is the reporting test; fall back to per-group recency.
        const declKey = declOpenOf(data).get(data.nesting ?? 0);
        const targetKey = lastStartedByGroupNesting.get(gk)?.get(data.nesting ?? 0);
        const target = (declKey && nodes.get(declKey))
          || (targetKey && nodes.get(targetKey)) || nodes.get(gk);
        if (target) target.messages.push({ kind: 'diagnostic', message: data.message, level: data.level ?? 'info' });
        break;
      }
      case 'test:stdout':
        if (data.message != null) ctx.group(data).stdout.push(data.message);
        break;
      case 'test:stderr':
        if (data.message != null) ctx.group(data).stderr.push(data.message);
        break;
      case 'test:summary':
        // A per-file summary trails its file's declaration block, closing it.
        // It also carries the file's wall-clock, for builds whose wrapper
        // completion lacks duration detail.
        if (data.file !== undefined) {
          declOpenOf(data).clear();
          const group = ctx.group(data);
          group.wrapperOpen = false;
          if (data.duration_ms != null) {
            group.durationMs = group.durationMs ?? data.duration_ms;
          }
        }
        // Keep the cumulative summary for the run verdict. Under --test that's
        // the one with no file; when run without --test (a single process, no
        // file wrappers) the only summary carries the file, so accept it too.
        if (data.file === undefined || !sawFileWrapper) {
          summary = {
            counts: data.counts ?? {},
            durationMs: data.duration_ms ?? 0,
            success: data.success ?? false,
          };
        }
        break;
      default:
        return;
    }
    dirty = true;
    for (const listener of listeners) listener();
  }

  function emptyCounts(): Counts {
    return { passed: 0, failed: 0, skipped: 0, todo: 0, running: 0, queued: 0, carried: 0, total: 0 };
  }

  function addCounts(into: Counts, from: Counts): void {
    into.passed += from.passed;
    into.failed += from.failed;
    into.skipped += from.skipped;
    into.todo += from.todo;
    into.running += from.running;
    into.queued += from.queued;
    into.carried += from.carried;
    into.total += from.total;
  }

  // A helper's group can end up empty once its subtests re-link under their
  // real parents in other groups; don't render such husks. Likewise a
  // placeholder created for an unresolved parentId whose children have since
  // re-linked away: it never got an event of its own, so it has no name.
  function isEmptyFileNode(node: TestNode): boolean {
    return node.type === 'file' && node.children.length === 0
      && node.stdout.length === 0 && node.stderr.length === 0 && node.messages.length === 0;
  }

  function isEmptyPlaceholder(node: TestNode): boolean {
    return node.type === 'test' && node.name === '' && node.children.length === 0
      && node.messages.length === 0;
  }

  function build(key: string): TestNode {
    const internal = nodes.get(key)!;
    const children = internal.childKeys.map(build)
      .filter((child) => !isEmptyFileNode(child) && !isEmptyPlaceholder(child));
    const counts = emptyCounts();
    if (children.length === 0 && internal.type !== 'file' && internal.type !== 'root') {
      counts.total = 1;
      counts[internal.status] += 1;
      if (internal.passedOnAttempt != null && internal.status === 'passed') counts.carried = 1;
    } else {
      for (const child of children) addCounts(counts, child.counts);
      // A parent whose own body is still executing is itself a running test —
      // its subtests so far may all have settled while it awaits more (or runs
      // teardown). Count it, so ancestors and the header can't read done early.
      // Once it settles it leaves the counts again: totals stay leaves-only.
      if ((internal.type === 'test' || internal.type === 'suite') && !TERMINAL.has(internal.status)) {
        counts[internal.status] += 1;
        counts.total += 1;
      }
    }
    // File and root nodes have no result event of their own; derive their
    // status from their descendants — and from the wrapper's own liveness,
    // which outlives the last settled test (hooks, subtests still to come).
    let { status } = internal;
    let error = internal.error ?? internal.wrapperError;
    if (internal.type === 'file' || internal.type === 'root') {
      if (counts.failed > 0) status = 'failed';
      else if (internal.wrapperFailed) {
        // The wrapper failed with every child settled green: the failure is
        // the file's own (a hook, the process exit), so the wrapper is the
        // failed test — count it. When a child failed, the wrapper's echo
        // stays out of the counts, but its error still lands on the node.
        status = 'failed';
        counts.failed += 1;
        counts.total += 1;
      }
      else if (counts.running > 0 || internal.wrapperOpen) status = 'running';
      else if (counts.queued > 0 && counts.passed + counts.skipped + counts.todo === 0) status = 'queued';
      else status = 'passed';
    }
    return {
      key: internal.key,
      testId: internal.testId,
      parentKey: internal.parentKey,
      file: internal.file,
      entryFile: internal.entryFile,
      name: internal.name,
      nesting: internal.nesting,
      type: internal.type,
      status,
      durationMs: internal.durationMs,
      startedAt: internal.startedAt,
      error,
      messages: internal.messages,
      stdout: internal.stdout,
      stderr: internal.stderr,
      children,
      line: internal.line,
      column: internal.column,
      tags: internal.tags,
      todo: internal.todo,
      skip: internal.skip,
      passedOnAttempt: internal.passedOnAttempt,
      counts,
    };
  }

  function getSnapshot(): TreeSnapshot {
    if (!dirty && cached) return cached;
    const rootNode = build(ROOT_KEY);
    cached = {
      version: ++version,
      root: rootNode,
      counts: rootNode.counts,
      summary,
      ...(runAttempt != null ? { attempt: runAttempt } : {}),
      // firstT and lastT are always set together (same stamped event).
      ...(firstT != null ? { clock: { firstT, lastT: lastT! } } : {}),
    };
    dirty = false;
    return cached;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { apply, getSnapshot, subscribe };
}
