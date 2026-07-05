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

/**
 * A passing leaf that still carries the todo directive: the store reports it
 * as passed (only failing todos keep the todo status), so renderers badge the
 * directive separately — it flags a candidate to un-todo, mirroring the spec
 * reporter's `\u2714 \u2026 # TODO`.
 */
export function isPassingTodo(node: TestNode): boolean {
  return node.status === 'passed' && node.children.length === 0
    && node.todo != null && node.todo !== false;
}

/**
 * The todo directive's display text, mirroring the spec reporter's
 * `# \u2026` suffix: the reason when one was given, else "TODO".
 */
export function todoLabel(node: TestNode): string | undefined {
  if (node.todo == null || node.todo === false) return undefined;
  return typeof node.todo === 'string' && node.todo.length > 0 ? node.todo : 'TODO';
}
