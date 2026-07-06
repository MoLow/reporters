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
import type { TestEvent } from '../src/types.ts';
import {
  allNodes, build, done, ev, findAll, findOne,
} from './util.ts';

const ENTRY = '/x/tests/s3.test.ts';
const HELPER = '/x/tests/s3Utils.ts';
const OTHER = '/x/tests/ddb.test.ts';
const OTHER_HELPER = '/x/tests/ddbUtils.ts';

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

test('an ambiguous eager parentId parks the subtest under its helper group instead of guessing', () => {
  // Live phase of a real run (Desktop/report.ndjson, 2026-07-06): three
  // concurrent processes each have an open testId 2 at nesting 1 when a helper
  // subtest with parentId 2 enqueues. Nothing in the event says which process
  // it came from, so it must wait under the helper-file group — attaching it to
  // whichever candidate happens to win a tie-break showed "restore GCE VM"
  // under a DynamoDB test for 20 minutes.
  const F3 = '/x/tests/gce.test.ts';
  const store = createTreeStore();
  for (const event of [
    ev('test:enqueue', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'gce backup', nesting: 1, file: F3, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'gce backup', nesting: 1, file: F3, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:dequeue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
  ]) store.apply(event);

  const live = store.getSnapshot();
  const { path } = findOne(live.root, 'restore VM');
  assert.deepStrictEqual(path, ['', HELPER], `ambiguous subtest stays under the helper group, got path: ${JSON.stringify(path)}`);

  // The declaration-ordered block later reveals the real parent; the parked
  // node must move under it and the helper group husk must disappear.
  for (const event of [
    ev('test:start', { name: 'gce backup', nesting: 1, file: F3, testId: 2, parentId: 0 }),
    ev('test:start', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2 }),
    ev('test:pass', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, details: done }),
    ev('test:pass', { name: 'gce backup', nesting: 1, file: F3, testId: 2, parentId: 0, details: done }),
  ]) store.apply(event);

  const { root } = store.getSnapshot();
  const { path: settled } = findOne(root, 'restore VM');
  assert.ok(settled.includes('gce backup'), `subtest settles under its real parent, got path: ${JSON.stringify(settled)}`);
  const helperGroups = root.children.filter((n) => n.file === HELPER);
  assert.deepStrictEqual(helperGroups, [], 'emptied helper group is pruned');
});

test('an eager parentId with a single open candidate still resolves immediately', () => {
  // Parking is only for genuine ambiguity — with one candidate the live tree
  // must keep showing helper subtests under their parent right away.
  const store = createTreeStore();
  for (const event of [
    ev('test:enqueue', { name: 'backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:dequeue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
  ]) store.apply(event);

  const { path } = findOne(store.getSnapshot().root, 'restore VM');
  assert.ok(path.includes('backup'), `unambiguous subtest attaches live, got path: ${JSON.stringify(path)}`);
});

test('a parked subtest is adopted as soon as the collision clears', () => {
  // Two open candidates → parked. One of them completes → the next eager event
  // for the child re-resolves against a single open candidate and promotes the
  // child out of the helper group without waiting for the declaration block.
  const store = createTreeStore();
  for (const event of [
    ev('test:enqueue', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'ddb backup', nesting: 1, file: OTHER, testId: 2, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
    ev('test:complete', { name: 's3 backup', nesting: 1, file: ENTRY, testId: 2, parentId: 0, details: done }),
    ev('test:dequeue', { name: 'restore VM', nesting: 2, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
  ]) store.apply(event);

  const { path } = findOne(store.getSnapshot().root, 'restore VM');
  assert.ok(path.includes('ddb backup'), `child promotes to the surviving candidate, got path: ${JSON.stringify(path)}`);
});

test('a mid-stream child with an unknown parentId anchors to a placeholder until its block resolves it', () => {
  // Tailing a stream mid-run: the child's eager events arrive but its parent
  // was enqueued before we started listening. The child needs a live anchor
  // (a placeholder for the unknown parentId), which must disappear once the
  // declaration block reveals the real parent.
  const store = createTreeStore();
  store.apply(ev('test:enqueue', { name: 'orphan restore', nesting: 2, file: HELPER, testId: 5, parentId: 3, type: 'test' }));

  const live = store.getSnapshot();
  const { path: livePath } = findOne(live.root, 'orphan restore');
  assert.strictEqual(livePath[livePath.length - 1], '', `live child hangs off a placeholder anchor, got path: ${JSON.stringify(livePath)}`);

  for (const event of [
    ev('test:start', { name: 'backup', nesting: 1, file: ENTRY, testId: 3, parentId: 0 }),
    ev('test:start', { name: 'orphan restore', nesting: 2, file: HELPER, testId: 5, parentId: 3 }),
    ev('test:pass', { name: 'orphan restore', nesting: 2, file: HELPER, testId: 5, parentId: 3, details: done }),
    ev('test:pass', { name: 'backup', nesting: 1, file: ENTRY, testId: 3, parentId: 0, details: done }),
  ]) store.apply(event);

  const { root } = store.getSnapshot();
  const { path } = findOne(root, 'orphan restore');
  assert.ok(path.includes('backup'), `child settles under its real parent, got path: ${JSON.stringify(path)}`);
  const nameless = allNodes(root).filter((n) => (n.type === 'test' || n.type === 'suite') && n.name === '');
  assert.deepStrictEqual(nameless, [], 'placeholder is pruned once empty');
});

test('a new top-level declaration start closes deeper open declaration levels', () => {
  // Suite A's child never reports a result (its process died); when suite B's
  // block starts, B's children must not attach to A's stale open child.
  const { root } = build([
    ev('test:start', { name: 'suite A', nesting: 0, file: ENTRY, testId: 1, parentId: 0 }),
    ev('test:start', { name: 'child A', nesting: 1, file: ENTRY, testId: 2, parentId: 1 }),
    ev('test:start', { name: 'suite B', nesting: 0, file: OTHER, testId: 1, parentId: 0 }),
    ev('test:start', { name: 'child B', nesting: 1, file: OTHER, testId: 2, parentId: 1 }),
    ev('test:pass', { name: 'child B', nesting: 1, file: OTHER, testId: 2, parentId: 1, details: done }),
    ev('test:pass', { name: 'suite B', nesting: 0, file: OTHER, testId: 1, parentId: 0, details: done }),
  ]);

  assert.deepStrictEqual(findOne(root, 'child A').path.pop(), 'suite A');
  assert.deepStrictEqual(findOne(root, 'child B').path.pop(), 'suite B');
});

test('a declaration result for a different test than the open one falls back to its own instance', () => {
  // The open declaration node at this nesting is another test (its result never
  // arrived); the pass must settle its own test, not the open one.
  const { root } = build([
    ev('test:start', { name: 'stuck', nesting: 0, file: ENTRY, testId: 1, parentId: 0 }),
    ev('test:pass', { name: 'quick', nesting: 0, file: ENTRY, testId: 2, parentId: 0, details: done }),
  ]);

  assert.strictEqual(findOne(root, 'quick').node.status, 'passed');
  assert.strictEqual(findOne(root, 'stuck').node.status, 'running');
});

test('a declaration start whose parentId matches neither the open node nor a local parent uses the open-parent lookup', () => {
  // The enclosing declaration slot holds an unrelated test (interleaved decl
  // streams), so the helper child must find its still-open parent by id.
  const { root } = build([
    ev('test:enqueue', { name: 'real parent', nesting: 0, file: ENTRY, testId: 7, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'real parent', nesting: 0, file: ENTRY, testId: 7, parentId: 0, type: 'test' }),
    ev('test:start', { name: 'unrelated top', nesting: 0, file: OTHER, testId: 9, parentId: 0 }),
    ev('test:start', { name: 'helper child', nesting: 1, file: HELPER, testId: 8, parentId: 7 }),
    ev('test:pass', { name: 'helper child', nesting: 1, file: HELPER, testId: 8, parentId: 7, details: done }),
  ]);

  const { path } = findOne(root, 'helper child');
  assert.ok(path.includes('real parent'), `child resolves by parentId, got path: ${JSON.stringify(path)}`);
  assert.ok(!path.includes('unrelated top'), 'child must not attach to the unrelated open declaration node');
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
