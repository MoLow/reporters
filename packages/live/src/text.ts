import {
  formatDuration, SYMBOLS, STATUS_LABEL, todoLabel, type TestNode, type TreeSnapshot, type TestStatus,
} from '@reporters/tree-core';

function basename(file: string | undefined): string {
  if (!file) return '<unknown>';
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || file;
}

function renderNode(node: TestNode, depth: number, lines: string[]): void {
  const indent = '  '.repeat(depth);
  const label = node.type === 'file' ? basename(node.file) : node.name;
  const duration = node.durationMs != null ? ` (${formatDuration(node.durationMs)})` : '';
  const todoTag = todoLabel(node) != null ? ` # ${todoLabel(node)}` : '';
  lines.push(`${indent}${SYMBOLS[node.status]} ${label}${duration}${todoTag}`);

  if (node.status === 'failed' && node.children.length === 0 && node.error) {
    const errIndent = '  '.repeat(depth + 2);
    for (const line of node.error.message.split('\n')) lines.push(`${errIndent}${line}`);
  }

  for (const child of node.children) renderNode(child, depth + 1, lines);
}

const SUMMARY_ORDER: TestStatus[] = ['passed', 'failed', 'skipped', 'todo', 'running', 'queued'];

export function renderTreeText(snapshot: TreeSnapshot): string {
  const lines: string[] = [];
  for (const file of snapshot.root.children) renderNode(file, 0, lines);

  const { counts } = snapshot;
  const parts = SUMMARY_ORDER
    .filter((status) => counts[status] > 0)
    .map((status) => `${SYMBOLS[status]} ${counts[status]} ${STATUS_LABEL[status]}`);
  if (snapshot.summary) parts.push(`(${formatDuration(snapshot.summary.durationMs)})`);
  lines.push('', parts.join('   '));

  return lines.join('\n');
}
