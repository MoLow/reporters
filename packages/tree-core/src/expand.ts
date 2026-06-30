import type { TestNode } from './types.ts';

/**
 * The smart-default expansion rule both reporters seed their interactive
 * collapse state from: files are always open; suites stay open while running or
 * if anything under them failed; fully-passed suites collapse to a count.
 */
export function defaultExpanded(node: TestNode): boolean {
  if (node.type === 'root' || node.type === 'file') return true;
  if (node.children.length === 0) return false;
  return node.counts.failed > 0 || node.counts.running > 0 || node.status === 'running';
}
