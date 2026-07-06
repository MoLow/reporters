import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent, TestNode } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const captureReporter = join(here, 'capture-reporter.mjs');

export function captureEvents(files: string[], extraArgs: string[] = []): TestEvent[] {
  // Strip NODE_TEST_CONTEXT so the spawned runner does not think it is a child
  // of this test process (which would make it serialize to a fd, not stdout).
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(
    process.execPath,
    ['--test', ...extraArgs, '--test-reporter', captureReporter, '--test-reporter-destination', 'stdout', ...files],
    { cwd: here, encoding: 'utf8', env },
  );
  return (child.stdout ?? '').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as TestEvent);
}

export function build(events: TestEvent[]) {
  const store = createTreeStore();
  for (const event of events) store.apply(event);
  return store.getSnapshot();
}

/** All nodes matching a name, each paired with its ancestor-name path. */
export function findAll(root: TestNode, name: string): { node: TestNode; path: string[] }[] {
  const found: { node: TestNode; path: string[] }[] = [];
  (function walk(node: TestNode, path: string[]) {
    if (node.name === name) found.push({ node, path });
    node.children.forEach((child) => walk(child, [...path, node.name]));
  }(root, []));
  return found;
}

export function findOne(root: TestNode, name: string): { node: TestNode; path: string[] } {
  const matches = findAll(root, name);
  assert.strictEqual(matches.length, 1, `expected exactly one node named "${name}", got ${matches.length}`);
  return matches[0];
}

export function allNodes(root: TestNode): TestNode[] {
  const nodes: TestNode[] = [];
  (function walk(node: TestNode) { nodes.push(node); node.children.forEach(walk); }(root));
  return nodes;
}

export const ev = (type: TestEvent['type'], data: TestEvent['data']): TestEvent => ({ type, data });

export const done = { passed: true, duration_ms: 1 };
