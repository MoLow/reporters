import type { TestNode } from './types.ts';

// Shared by every node — the walk needs nothing but `this.parent`, so there is
// no per-node closure to allocate.
function ancestors(this: TestNode): TestNode[] {
  const path: TestNode[] = [];
  for (let node = this.parent; node != null; node = node.parent) path.unshift(node);
  return path;
}

/**
 * Installs a node's lineage: `ancestors()` on the node, and `parent` on each of
 * the children it was built from. The tree is built bottom-up, so a child
 * object always exists by the time its parent is assembled.
 *
 * Both are non-enumerable, which is what keeps the upward reference from making
 * the tree cyclic: `Object.keys`, spreads, `JSON.stringify`, `structuredClone`
 * and `assert.deepStrictEqual` all walk own enumerable properties, so a
 * snapshot serializes and compares exactly as it did without them.
 */
export function withLineage(data: Omit<TestNode, 'parent' | 'ancestors'>): TestNode {
  const node = data as TestNode;
  Object.defineProperty(node, 'ancestors', { value: ancestors });
  for (const child of node.children) Object.defineProperty(child, 'parent', { value: node });
  return node;
}
