// The exact-resolution path: once events carry `entryFile`, (entryFile, testId)
// identifies a test exactly, so none of the cross-process guessing in
// isolation-collisions.test.ts applies. These mirror those scenarios with the
// field present, and assert the guessing is gone rather than merely unused.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  allNodes, build, done, ev, findAll, findOne,
} from './util.ts';

const A = '/x/tests/a.test.ts';
const B = '/x/tests/b.test.ts';
const HELPER = '/x/tests/helper.ts';

/** A child-forwarded event: carries the entry file of the process that ran it. */
const child = (
  type: string,
  entryFile: string,
  data: Record<string, unknown>,
) => ev(type, { entryFile, ...data });

/** A parent-emitted file wrapper: no entryFile, and `file` IS the entry file. */
const wrapper = (type: string, file: string, extra: Record<string, unknown> = {}) => ev(type, {
  name: file, file, nesting: 0, testId: 1, parentId: 0, ...extra,
});

test('the same testId in two entry files stays two distinct tests', () => {
  // Both processes number their first test 1 and report the same helper as
  // `file`. Grouping by entryFile keeps them apart with no instance splitting.
  const { root } = build([
    child('test:enqueue', A, { name: 'shared', nesting: 0, file: HELPER, testId: 1, parentId: 0, type: 'test' }),
    child('test:enqueue', B, { name: 'shared', nesting: 0, file: HELPER, testId: 1, parentId: 0, type: 'test' }),
    child('test:complete', A, { name: 'shared', nesting: 0, file: HELPER, testId: 1, parentId: 0, details: done }),
    child('test:complete', B, { name: 'shared', nesting: 0, file: HELPER, testId: 1, parentId: 0, details: done }),
  ]);

  const matches = findAll(root, 'shared');
  assert.strictEqual(matches.length, 2, 'one per entry file');
  assert.deepStrictEqual(
    root.children.filter((n) => n.type === 'file').map((n) => n.file).sort(),
    [A, B],
  );
  assert.deepStrictEqual(
    root.children.filter((n) => n.type === 'file').flatMap((n) => n.children.map((c) => c.file)),
    [HELPER, HELPER],
    'each keeps the helper as its definition site',
  );
});

test('a helper-defined subtest attaches to its parent on the eager event, never parked', () => {
  // Both processes have an open testId 2 when the subtest arrives. Under the
  // heuristic path this is the ambiguous case that parks the child under the
  // helper group; here parentId is scoped by entryFile, so it resolves at once.
  const { root } = build([
    child('test:dequeue', A, { name: 'a parent', nesting: 0, file: A, testId: 2, parentId: 0, type: 'test' }),
    child('test:dequeue', B, { name: 'b parent', nesting: 0, file: B, testId: 2, parentId: 0, type: 'test' }),
    child('test:dequeue', B, { name: 'b sub', nesting: 1, file: HELPER, testId: 3, parentId: 2, type: 'test' }),
  ]);

  const { path } = findOne(root, 'b sub');
  assert.ok(path.includes('b parent'), `expected it under b parent, got ${JSON.stringify(path)}`);
  assert.ok(!path.includes('a parent'), 'must not attach to the other process');
  assert.deepStrictEqual(
    root.children.filter((n) => n.file === HELPER),
    [],
    'no helper-file group: nothing was parked',
  );
});

test('a subtest whose parent has not reported yet anchors to a placeholder in its own entry file', () => {
  const { root } = build([
    child('test:dequeue', A, { name: 'orphan sub', nesting: 1, file: HELPER, testId: 9, parentId: 4, type: 'test' }),
    child('test:start', A, { name: 'late parent', nesting: 0, file: A, testId: 4, parentId: 0 }),
    child('test:start', A, { name: 'orphan sub', nesting: 1, file: HELPER, testId: 9, parentId: 4 }),
    child('test:pass', A, { name: 'orphan sub', nesting: 1, file: HELPER, testId: 9, parentId: 4, details: done }),
    child('test:pass', A, { name: 'late parent', nesting: 0, file: A, testId: 4, parentId: 0, details: done }),
  ]);

  const { path } = findOne(root, 'orphan sub');
  assert.ok(path.includes('late parent'), `expected it under late parent, got ${JSON.stringify(path)}`);
  const nameless = allNodes(root).filter((n) => (n.type === 'test' || n.type === 'suite') && n.name === '');
  assert.deepStrictEqual(nameless, [], 'the placeholder was claimed, not left behind');
});

test('a test named after its own file is not mistaken for a file wrapper', () => {
  // The heuristic path matches wrappers on basename, so a test literally named
  // like its file reads as one. entryFile makes the distinction exact: only the
  // parent runner omits it.
  const { root } = build([
    wrapper('test:enqueue', A),
    child('test:enqueue', A, { name: 'a.test.ts', nesting: 0, file: A, testId: 1, parentId: 0, type: 'test' }),
    child('test:start', A, { name: 'a.test.ts', nesting: 0, file: A, testId: 1, parentId: 0 }),
    child('test:pass', A, { name: 'a.test.ts', nesting: 0, file: A, testId: 1, parentId: 0, details: done }),
  ]);

  const fileNodes = root.children.filter((n) => n.type === 'file');
  assert.strictEqual(fileNodes.length, 1);
  assert.strictEqual(fileNodes[0].children.length, 1, 'the test is a child, not swallowed by the wrapper');
  assert.strictEqual(fileNodes[0].children[0].name, 'a.test.ts');
  assert.strictEqual(fileNodes[0].children[0].status, 'passed');
});

test('a wrapper event groups with the child events it forwarded', () => {
  // The wrapper carries no entryFile, but its `file` is the entry file — so both
  // must land on one group node, wrapper liveness included.
  const { root } = build([
    wrapper('test:enqueue', A),
    wrapper('test:dequeue', A),
    child('test:complete', A, { name: 'inner', nesting: 0, file: A, testId: 1, parentId: 0, details: done }),
    wrapper('test:complete', A, { details: { passed: true, duration_ms: 40 } }),
  ]);

  const fileNodes = root.children.filter((n) => n.type === 'file');
  assert.strictEqual(fileNodes.length, 1, 'wrapper and children share one group');
  assert.strictEqual(fileNodes[0].durationMs, 40, "the wrapper's wall-clock lands on the group");
  assert.strictEqual(findOne(root, 'inner').node.status, 'passed');
});

test('test:stdout reported CLI-relative still groups with its tests', () => {
  // stdout reports `file` relative while entryFile is absolute; grouping by
  // entryFile makes them agree without the wrapper name/file alias.
  const { root } = build([
    ev('test:stdout', { file: 'tests/a.test.ts', entryFile: A, message: 'hello\n' }),
    child('test:complete', A, { name: 'inner', nesting: 0, file: A, testId: 1, parentId: 0, details: done }),
  ]);

  const fileNodes = root.children.filter((n) => n.type === 'file');
  assert.strictEqual(fileNodes.length, 1, 'stdout and tests must share one file node');
  assert.deepStrictEqual(fileNodes[0].stdout, ['hello\n']);
  assert.strictEqual(fileNodes[0].children[0].name, 'inner');
});

test('a child diagnostic attributes to the last started test in its own entry file', () => {
  // Diagnostics carry entryFile but no testId, so they still need recency —
  // scoped per entry file, two concurrent files cannot steal each other's.
  const { root } = build([
    child('test:start', A, { name: 'a test', nesting: 0, file: A, testId: 1, parentId: 0 }),
    child('test:start', B, { name: 'b test', nesting: 0, file: B, testId: 1, parentId: 0 }),
    child('test:diagnostic', A, { nesting: 0, file: HELPER, message: 'from a', level: 'info' }),
    child('test:diagnostic', B, { nesting: 0, file: HELPER, message: 'from b', level: 'info' }),
  ]);

  assert.deepStrictEqual(findOne(root, 'a test').node.messages.map((m) => m.message), ['from a']);
  assert.deepStrictEqual(findOne(root, 'b test').node.messages.map((m) => m.message), ['from b']);
});

test('declaration blocks interleaved across entry files keep their own nesting stacks', () => {
  // Each process reports its own declaration order. With one shared stack an
  // interleaved block would mis-parent; per-entry-file stacks cannot.
  const { root } = build([
    child('test:start', A, { name: 'a suite', nesting: 0, file: A, testId: 1, parentId: 0, type: 'suite' }),
    child('test:start', B, { name: 'b suite', nesting: 0, file: B, testId: 1, parentId: 0, type: 'suite' }),
    child('test:start', A, { name: 'a child', nesting: 1, file: A, testId: 2, parentId: 1 }),
    child('test:start', B, { name: 'b child', nesting: 1, file: B, testId: 2, parentId: 1 }),
    child('test:pass', A, { name: 'a child', nesting: 1, file: A, testId: 2, parentId: 1, details: done }),
    child('test:pass', B, { name: 'b child', nesting: 1, file: B, testId: 2, parentId: 1, details: done }),
    child('test:pass', A, { name: 'a suite', nesting: 0, file: A, testId: 1, parentId: 0, details: { ...done, type: 'suite' } }),
    child('test:pass', B, { name: 'b suite', nesting: 0, file: B, testId: 1, parentId: 0, details: { ...done, type: 'suite' } }),
  ]);

  assert.ok(findOne(root, 'a child').path.includes('a suite'));
  assert.ok(findOne(root, 'b child').path.includes('b suite'));
  assert.strictEqual(root.counts.passed, 2);
  assert.strictEqual(root.counts.failed, 0);
});

test('a replayed stream is idempotent on the exact path', () => {
  const events = [
    child('test:enqueue', A, { name: 'inner', nesting: 0, file: HELPER, testId: 1, parentId: 0, type: 'test' }),
    child('test:start', A, { name: 'inner', nesting: 0, file: HELPER, testId: 1, parentId: 0 }),
    child('test:pass', A, { name: 'inner', nesting: 0, file: HELPER, testId: 1, parentId: 0, details: done }),
  ];
  const once = build(events);
  const twice = build([...events, ...events]);

  assert.deepStrictEqual(twice.counts, once.counts);
  assert.strictEqual(findAll(twice.root, 'inner').length, 1);
});

test('a top-level test reports parentId 0 and hangs off its entry file', () => {
  const { root } = build([
    child('test:start', A, { name: 'top', nesting: 0, file: A, testId: 1, parentId: 0 }),
    child('test:pass', A, { name: 'top', nesting: 0, file: A, testId: 1, parentId: 0, details: done }),
  ]);

  const { path } = findOne(root, 'top');
  assert.deepStrictEqual(path, ['', A], 'root then the entry-file group');
});
