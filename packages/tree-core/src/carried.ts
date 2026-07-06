import type { TestNode } from './types.ts';

/** Carried overlay: a leaf that passed without executing this attempt, or a
 *  container whose every test descendant did. */
export function isCarried(node: TestNode): boolean {
  if (node.children.length === 0) return node.passedOnAttempt != null;
  return node.counts.carried > 0 && node.counts.carried === node.counts.total;
}

/** The attempt shared by every carried test under `node`, else undefined. */
export function carriedAttempt(node: TestNode): number | undefined {
  let attempt: number | undefined;
  let mixed = false;
  const walk = (n: TestNode): void => {
    if (mixed) return;
    if (n.children.length === 0) {
      if (n.passedOnAttempt == null) return;
      if (attempt == null) attempt = n.passedOnAttempt;
      else if (attempt !== n.passedOnAttempt) mixed = true;
      return;
    }
    for (const child of n.children) walk(child);
  };
  walk(node);
  return mixed ? undefined : attempt;
}
