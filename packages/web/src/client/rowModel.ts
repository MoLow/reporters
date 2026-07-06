import type { TestNode, TestStatus } from '@reporters/tree-core';

const SEVERITY: TestStatus[] = ['failed', 'running', 'queued', 'todo', 'skipped', 'passed'];

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
 * Like `nodeDuration`, but a still-running leaf counts the time elapsed since
 * the client first saw it running (`since`), so its counter ticks live between
 * polls instead of sitting at 0 until the run settles.
 */
export function liveNodeDuration(node: TestNode, now: number, since: Map<string, number>): number {
  if (!isContainer(node) && node.status === 'running') {
    if (!since.has(node.key)) since.set(node.key, now); // first sight: start the clock
    return Math.max(0, now - since.get(node.key)!);
  }
  if (node.durationMs != null) return node.durationMs;
  if (!isContainer(node)) return 0;
  return node.children.reduce((total, child) => total + liveNodeDuration(child, now, since), 0);
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
  if (node.type === 'suite') return counts.failed > 0 || counts.running > 0;
  return false;
}

export interface FlatRow {
  node: TestNode;
  depth: number;
  status: TestStatus;
  container: boolean;
  expanded: boolean;
  hasDiag: boolean;
  diagOpen: boolean;
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

export function isDiagOpen(node: TestNode, overrides: Map<string, boolean>): boolean {
  const key = `${node.key}::diag`;
  if (overrides.has(key)) return overrides.get(key)!;
  // Only a failed *leaf* auto-opens; a container's aggregated output stays
  // closed until asked, so it can't bury the tree.
  return !isContainer(node) && node.status === 'failed';
}

export function buildRows(files: TestNode[], opts: BuildOptions): FlatRow[] {
  const rows: FlatRow[] = [];
  const push = (node: TestNode, depth: number): void => {
    if (filtering(opts) && !opts.matches!.visible.has(node.key)) return;
    const container = isContainer(node);
    const expanded = container && isExpanded(node, opts);
    // A container (a file or suite) can still carry its own output — e.g.
    // top-level stdout/stderr on the file node — so it gets a diagnostics
    // affordance too. But collapsing a container hides its output along with
    // its children, so it only surfaces diagnostics while expanded.
    const diag = hasDiagnostics(node) && (!container || expanded);
    rows.push({
      node,
      depth,
      status: rollup(node),
      container,
      expanded,
      hasDiag: diag,
      diagOpen: diag && isDiagOpen(node, opts.overrides),
    });
    if (container && expanded) {
      for (const child of node.children) push(child, depth + 1);
    }
  };
  for (const file of files) push(file, 0);
  return rows;
}

export function collectContainerKeys(nodes: TestNode[], into: string[]): void {
  for (const node of nodes) {
    if (isContainer(node)) { into.push(node.key); collectContainerKeys(node.children, into); }
  }
}

export function collectDiagKeys(nodes: TestNode[], into: string[]): void {
  for (const node of nodes) {
    if (hasDiagnostics(node)) into.push(`${node.key}::diag`);
    collectDiagKeys(node.children, into);
  }
}
