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
 * A descendant that would count toward a duration but carries no stamp — a
 * mixed old/new-writer log. A span would silently drop it, so its container
 * must fall back to summing instead. Anything measured counts (suites too);
 * `running` only on leaves, since containers derive that status from children
 * and files never carry a stamp of their own.
 */
function hasUnstampedContributor(node: TestNode): boolean {
  if (node.startedAt == null
    && (node.durationMs != null || (!isContainer(node) && node.status === 'running'))) return true;
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

/**
 * Container status = the worst status among descendants (severity order),
 * folding in the container's own status while it is still open — a parent
 * test awaiting subtests, or a file whose wrapper hasn't completed, must not
 * read ✓ just because everything it produced so far has settled. Terminal own
 * statuses stay out: descendants alone decide a finished container's color.
 */
export function rollup(node: TestNode): TestStatus {
  if (!isContainer(node)) return node.status;
  const own = node.status === 'running' || node.status === 'queued' ? node.status : undefined;
  for (const s of SEVERITY) if (node.counts[s] > 0 || own === s) return s;
  return 'passed';
}

export { isPassingTodo } from '@reporters/tree-core';

export function reasonOf(node: TestNode): string | undefined {
  if (typeof node.skip === 'string') return node.skip;
  if (typeof node.todo === 'string') return node.todo;
  return undefined;
}

// A test the runner cancelled before its body ever ran, per node:test's own
// classification: the parent settled first, or the test's signal aborted. Its
// error is a fixed sentence about the cancellation with no cause underneath.
const CANCELLED: ReadonlySet<string> = new Set(['cancelledByParent', 'testAborted']);

export function isCancelled(node: TestNode): boolean {
  return node.error?.failureType != null && CANCELLED.has(node.error.failureType);
}

/** Node's "N subtests failed" rollup — the node's own body was fine, a child
 *  failed. The child rows say which, so the row shows the count, not a panel. */
export function isSubtestsRollup(node: TestNode): boolean {
  return node.error?.failureType === 'subtestsFailed';
}

/** The row carries a rolled-up `N failed` chip. Containers only: a failed leaf
 *  counts itself, and "1 failed" beside a red test row says nothing. */
export function hasFailChip(node: TestNode): boolean {
  return isContainer(node) && node.counts.failed > 0;
}

/**
 * Any error the node reported is shown — containers included. A container's
 * error can be the only place the real cause lives (a suite whose before hook
 * failed cancels its children with a generic message), so nothing is filtered
 * on message text.
 *
 * The exceptions are the two errors the runner writes itself, both identified
 * structurally by its own `failureType` so a real cause is never at risk:
 *
 *  - a cancellation, written in place of an error the test never produced;
 *  - the "N subtests failed" rollup, but only while the row's fail chip is
 *    there to say the same thing. No count, no chip, no suppression.
 *
 * A failed hook reports `hookFailed` and stays fully visible, and a log written
 * before the wire carried `failureType` keeps every error it has.
 */
export function realError(node: TestNode): { message: string; stack?: string } | undefined {
  if (isCancelled(node)) return undefined;
  if (isSubtestsRollup(node) && hasFailChip(node)) return undefined;
  return node.error;
}

export interface OutLine { stream: 'out' | 'err'; text: string; }

/** stdout + stderr merged into one line list, stream-tagged (ANSI kept — the
 *  renderer colors it). The one place output becomes lines, so the count on the
 *  row button and the count on the Output tab can never disagree. */
export function outputLines(node: TestNode): OutLine[] {
  const lines: OutLine[] = [];
  const add = (chunks: string[], stream: 'out' | 'err'): void => {
    if (chunks.length === 0) return;
    for (const line of chunks.join('').split('\n')) lines.push({ stream, text: line });
  };
  add(node.stdout, 'out');
  add(node.stderr, 'err');
  while (lines.length > 0 && lines[lines.length - 1].text === '') lines.pop();
  return lines;
}

/** How much there is to read inside a node: the error, its output lines and its
 *  messages. This is what the row's log button shows, and it is by construction
 *  the sum of the popup's three tab counts. */
export function logCount(node: TestNode): number {
  return (realError(node) ? 1 : 0) + outputLines(node).length + node.messages.length;
}

/** The node has something the popup can show. A skip/todo reason alone doesn't
 *  count — that lives on the row chip, not behind a button. */
export function hasDiagnostics(node: TestNode): boolean {
  return logCount(node) > 0;
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
  /** The row has children to reveal. Output is no longer a disclosure — it
   *  opens in the popup — so this is exactly "is a container". */
  expandable: boolean;
  expanded: boolean;
  /** The node carries logs, so the row shows a log button. */
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
export function computeMatches(files: TestNode[], query: string, statuses: ReadonlySet<TestStatus> = new Set(), onlyRerun = false): Matches {
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
    // A test/suite whose own body is still open is a match in its own right —
    // it is what the running/queued counts include, so the status filter must
    // surface it even when every leaf under it has settled. Terminal
    // containers stay leaves-only, matching the counts.
    const openContainer = node.children.length > 0
      && (node.type === 'test' || node.type === 'suite')
      && (node.status === 'running' || node.status === 'queued');
    // Same rule for a file failed by its own wrapper (hook, process exit): its
    // failure is in the counts with no failed leaf underneath to stand for it.
    const ownFailedFile = node.type === 'file' && node.status === 'failed'
      && !node.children.some((child) => child.counts.failed > 0);
    const leafMatch = (node.children.length === 0 || openContainer || ownFailedFile) && textOk && statusOk(node)
      && (!onlyRerun || node.passedOnAttempt == null);
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
  onlyRerun?: boolean;
  matches: Matches | null;
}

function filtering(opts: BuildOptions): boolean {
  return opts.query !== '' || (opts.statuses?.size ?? 0) > 0 || opts.onlyRerun === true;
}

/**
 * Open state, most specific first: what the reader asked for, then what the
 * active filter needs, then the per-type default.
 *
 * The filter's force-expand is a default, not a lock. It exists so a match is
 * on screen without being hunted for — but it used to sit above `overrides`,
 * which meant every caret under an active search or status chip computed a new
 * state and then had it overwritten. Rows simply would not close.
 */
export function isExpanded(node: TestNode, opts: BuildOptions): boolean {
  const { overrides } = opts;
  if (overrides.has(node.key)) return overrides.get(node.key)!;
  if (filtering(opts) && opts.matches?.force.has(node.key)) return true;
  return defaultExpanded(node);
}

// The tree is one row per node, nothing else. A node's own output is not a
// disclosure any more — it opens in the logs popup — so expanding only ever
// reveals children.
export function buildRows(files: TestNode[], opts: BuildOptions): FlatRow[] {
  const rows: FlatRow[] = [];
  const push = (node: TestNode, depth: number): void => {
    if (filtering(opts) && !opts.matches!.visible.has(node.key)) return;
    const expandable = isContainer(node);
    const expanded = expandable && isExpanded(node, opts);
    rows.push({
      node, depth, status: rollup(node), expandable, expanded, hasDiag: hasDiagnostics(node),
    });
    if (!expanded) return;
    for (const child of node.children) push(child, depth + 1);
  };
  for (const file of files) push(file, 0);
  return rows;
}

/** The node with this key, anywhere in the tree. The popup holds a key rather
 *  than a node so it survives a live run rebuilding the snapshot underneath it,
 *  and re-reads the node — with its newest output — on every poll. */
export function findNode(nodes: TestNode[], key: string): TestNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    const hit = findNode(node.children, key);
    if (hit) return hit;
  }
  return undefined;
}

/** Keys of every expandable row. */
export function collectContainerKeys(nodes: TestNode[], into: string[]): void {
  for (const node of nodes) {
    if (isContainer(node)) into.push(node.key);
    collectContainerKeys(node.children, into);
  }
}
