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

/** Container status = the worst status among descendants (severity order). */
export function rollup(node: TestNode): TestStatus {
  if (!isContainer(node)) return node.status;
  for (const s of SEVERITY) if (node.counts[s] > 0) return s;
  return 'passed';
}

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

export function computeMatches(files: TestNode[], query: string): Matches {
  const visible = new Set<string>();
  const force = new Set<string>();
  const addSubtree = (node: TestNode): void => {
    for (const child of node.children) { visible.add(child.key); addSubtree(child); }
  };
  const walk = (node: TestNode, ancestors: string[]): boolean => {
    const self = displayName(node).toLowerCase().includes(query);
    let desc = false;
    for (const child of node.children) if (walk(child, [...ancestors, node.key])) desc = true;
    if (self || desc) {
      visible.add(node.key);
      for (const a of ancestors) visible.add(a);
      if (desc) { force.add(node.key); for (const a of ancestors) force.add(a); }
      if (self && node.children.length > 0) addSubtree(node);
      return true;
    }
    return false;
  };
  for (const file of files) walk(file, []);
  return { visible, force };
}

export interface BuildOptions {
  overrides: Map<string, boolean>;
  query: string;
  matches: Matches | null;
}

export function isExpanded(node: TestNode, opts: BuildOptions): boolean {
  if (opts.query && opts.matches?.force.has(node.key)) return true;
  const { overrides } = opts;
  return overrides.has(node.key) ? overrides.get(node.key)! : defaultExpanded(node);
}

export function isDiagOpen(node: TestNode, overrides: Map<string, boolean>): boolean {
  const key = `${node.key}::diag`;
  return overrides.has(key) ? overrides.get(key)! : node.status === 'failed';
}

export function buildRows(files: TestNode[], opts: BuildOptions): FlatRow[] {
  const rows: FlatRow[] = [];
  const push = (node: TestNode, depth: number): void => {
    if (opts.query && !opts.matches!.visible.has(node.key)) return;
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
