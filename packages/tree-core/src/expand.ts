import type { TestNode } from './types.ts';

/**
 * Whether a node's children are expanded by default. The tree stays fully
 * expanded so you always see every test (and what's running) — only
 * diagnostics/logs collapse, which each renderer handles separately. A leaf has
 * nothing to expand.
 */
export function defaultExpanded(node: TestNode): boolean {
  return node.children.length > 0;
}
