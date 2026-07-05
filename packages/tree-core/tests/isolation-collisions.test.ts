// Regression tests for cross-process testId collisions under `--test` process
// isolation (distilled from a real 40-file concurrent run). testId/parentId are
// only unique within a file's process, and subtests defined in shared helper
// files report the helper as `file`, so every process's events land in the same
// group with colliding ids. Structure must therefore come from the
// declaration-ordered events (test:start/pass/fail — a depth-first traversal of
// the real tree), with execution-ordered events providing liveness only.
import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent, TestNode } from '../src/types.ts';

function build(events: TestEvent[]) {
  const store = createTreeStore();
  for (const event of events) store.apply(event);
  return store.getSnapshot();
}

function findAll(root: TestNode, name: string): { node: TestNode; path: string[] }[] {
  const found: { node: TestNode; path: string[] }[] = [];
  (function walk(node: TestNode, path: string[]) {
    if (node.name === name) found.push({ node, path });
    node.children.forEach((child) => walk(child, [...path, node.name]));
  }(root, []));
  return found;
}

function findOne(root: TestNode, name: string): { node: TestNode; path: string[] } {
  const matches = findAll(root, name);
  assert.strictEqual(matches.length, 1, `expected exactly one node named "${name}", got ${matches.length}`);
  return matches[0];
}

function allNodes(root: TestNode): TestNode[] {
  const nodes: TestNode[] = [];
  (function walk(node: TestNode) { nodes.push(node); node.children.forEach(walk); }(root));
  return nodes;
}

const ENTRY = '/x/tests/s3.test.ts';
const HELPER = '/x/tests/s3Utils.ts';
const OTHER = '/x/tests/ddb.test.ts';
const OTHER_HELPER = '/x/tests/ddbUtils.ts';

const ev = (type: TestEvent['type'], data: TestEvent['data']): TestEvent => ({ type, data });
const done = { passed: true, duration_ms: 1 };

test('late buffered start does not re-parent a helper subtest onto a husk', () => {
  // Real pattern: the child's eager events resolve the parent correctly, then
  // the parent's test:complete arrives (execution-ordered), and only later the
  // buffered declaration-ordered start/pass for the child. Re-resolving at that
  // point used to fabricate a nameless "#parentId" node in the helper group and
  // move the child onto it.
  const { root } = build([
    ev('test:enqueue', { name: 'backup', nesting: 1, file: ENTRY, testId: 26, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'backup', nesting: 1, file: ENTRY, testId: 26, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'restore object', nesting: 2, file: HELPER, testId: 27, parentId: 26, type: 'test' }),
    ev('test:dequeue', { name: 'restore object', nesting: 2, file: HELPER, testId: 27, parentId: 26, type: 'test' }),
    ev('test:complete', { name: 'restore object', nesting: 2, file: HELPER, testId: 27, parentId: 26, details: done }),
    ev('test:complete', { name: 'backup', nesting: 1, file: ENTRY, testId: 26, parentId: 0, details: done }),
    // buffered declaration-ordered block, long after the completes
    ev('test:start', { name: 'backup', nesting: 1, file: ENTRY, testId: 26, parentId: 0 }),
    ev('test:start', { name: 'restore object', nesting: 2, file: HELPER, testId: 27, parentId: 26 }),
    ev('test:pass', { name: 'restore object', nesting: 2, file: HELPER, testId: 27, parentId: 26, details: done }),
    ev('test:pass', { name: 'backup', nesting: 1, file: ENTRY, testId: 26, parentId: 0, details: done }),
  ]);

  const { path } = findOne(root, 'restore object');
  assert.ok(path.includes('backup'), `helper subtest must stay under its parent, got path: ${JSON.stringify(path)}`);
  const nameless = allNodes(root).filter((n) => (n.type === 'test' || n.type === 'suite') && n.name === '');
  assert.deepStrictEqual(nameless, [], 'no nameless husk nodes');
  const helperGroups = root.children.filter((n) => n.file === HELPER);
  assert.deepStrictEqual(helperGroups, [], 'no top-level helper-file group');
});

test('colliding parentId across concurrent processes does not steal a helper subtest', () => {
  // Two files run concurrently; both have an open testId 2. The helper subtest
  // from OTHER's process (parentId 2) must attach under OTHER's test, not
  // ENTRY's, even though both candidates are open when its events arrive —
  // the declaration-ordered block is what disambiguates.
  const { root } = build([
    // both processes enqueue their testId 2 (colliding ids, both open)
    ev('test:enqueue', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, type: 'test' }),
    // helper subtest from OTHER's process; parentId 2 is ambiguous right now
    ev('test:enqueue', { name: 'ddb restore', nesting: 2, file: OTHER_HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:dequeue', { name: 'ddb restore', nesting: 2, file: OTHER_HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:complete', { name: 'ddb restore', nesting: 2, file: OTHER_HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:complete', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, details: done }),
    // OTHER's declaration-ordered block flushes first (it finished first)
    ev('test:start', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0 }),
    ev('test:start', { name: 'ddb restore', nesting: 2, file: OTHER_HELPER, testId: 3, parentId: 2 }),
    ev('test:pass', { name: 'ddb restore', nesting: 2, file: OTHER_HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:pass', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, details: done }),
    // ENTRY's process finishes later
    ev('test:complete', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, details: done }),
    ev('test:start', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0 }),
    ev('test:pass', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, details: done }),
  ]);

  const { path } = findOne(root, 'ddb restore');
  assert.ok(path.includes('ddb backup'), `subtest belongs to OTHER's test, got path: ${JSON.stringify(path)}`);
  assert.ok(!path.includes('s3 backup'), `subtest must not attach to the colliding open test, got path: ${JSON.stringify(path)}`);
});

test('same-testId helper subtests from different processes stay distinct nodes', () => {
  // Three processes each define a differently-named subtest in the same shared
  // helper, all with testId 42. Keying nodes by (file, testId) merged them into
  // one node whose name was whichever event applied last.
  const files = ['/x/tests/a.test.ts', '/x/tests/b.test.ts', '/x/tests/c.test.ts'];
  const names = ['scan alpha', 'scan beta', 'scan gamma'];
  const events: TestEvent[] = [];
  files.forEach((file, i) => {
    events.push(
      ev('test:enqueue', { name: `backup ${i}`, nesting: 1, file, testId: 7, parentId: 0, type: 'test' }),
      ev('test:dequeue', { name: `backup ${i}`, nesting: 1, file, testId: 7, parentId: 0, type: 'test' }),
      ev('test:enqueue', { name: names[i], nesting: 2, file: HELPER, testId: 42, parentId: 7, type: 'test' }),
      ev('test:dequeue', { name: names[i], nesting: 2, file: HELPER, testId: 42, parentId: 7, type: 'test' }),
    );
  });
  files.forEach((file, i) => {
    events.push(
      ev('test:complete', { name: names[i], nesting: 2, file: HELPER, testId: 42, parentId: 7, details: done }),
      ev('test:complete', { name: `backup ${i}`, nesting: 1, file, testId: 7, parentId: 0, details: done }),
      ev('test:start', { name: `backup ${i}`, nesting: 1, file, testId: 7, parentId: 0 }),
      ev('test:start', { name: names[i], nesting: 2, file: HELPER, testId: 42, parentId: 7 }),
      ev('test:pass', { name: names[i], nesting: 2, file: HELPER, testId: 42, parentId: 7, details: done }),
      ev('test:pass', { name: `backup ${i}`, nesting: 1, file, testId: 7, parentId: 0, details: done }),
    );
  });
  const { root } = build(events);

  names.forEach((name, i) => {
    const { node, path } = findOne(root, name);
    assert.strictEqual(node.status, 'passed');
    assert.ok(path.includes(`backup ${i}`), `"${name}" belongs under "backup ${i}", got path: ${JSON.stringify(path)}`);
  });
});

test('identical helper subtests from two processes each attach to their own parent', () => {
  // Two files run the same helper flow: both subtests are named "restore VM"
  // with testId 3 and parentId 2 — byte-identical events from different
  // processes. The declaration blocks are the only thing telling them apart.
  const F1 = '/x/tests/gceAws.test.ts';
  const F2 = '/x/tests/gceGcp.test.ts';
  const { root } = build([
    ev('test:enqueue', { name: 'gce backup aws', nesting: 1, file: F1, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'gce backup aws', nesting: 1, file: F1, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'gce backup gcp', nesting: 1, file: F2, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'gce backup gcp', nesting: 1, file: F2, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:enqueue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:complete', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:complete', { name: 'gce backup aws', nesting: 1, file: F1, testId: 2, parentId: 0, details: done }),
    ev('test:complete', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:complete', { name: 'gce backup gcp', nesting: 1, file: F2, testId: 2, parentId: 0, details: done }),
    // F1's declaration block
    ev('test:start', { name: 'gce backup aws', nesting: 1, file: F1, testId: 2, parentId: 0 }),
    ev('test:start', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2 }),
    ev('test:pass', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:pass', { name: 'gce backup aws', nesting: 1, file: F1, testId: 2, parentId: 0, details: done }),
    // F2's declaration block
    ev('test:start', { name: 'gce backup gcp', nesting: 1, file: F2, testId: 2, parentId: 0 }),
    ev('test:start', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2 }),
    ev('test:pass', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:pass', { name: 'gce backup gcp', nesting: 1, file: F2, testId: 2, parentId: 0, details: done }),
  ]);

  const matches = findAll(root, 'restore VM');
  assert.strictEqual(matches.length, 2, 'each process keeps its own instance');
  assert.deepStrictEqual(
    matches.map(({ path }) => path[path.length - 1]).sort(),
    ['gce backup aws', 'gce backup gcp'],
  );
  for (const { node } of matches) assert.strictEqual(node.status, 'passed');
});
