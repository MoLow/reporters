import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent, TestNode } from '../src/types.ts';

function shape(node: TestNode): unknown {
  return {
    type: node.type,
    name: node.name,
    status: node.status,
    file: node.file,
    children: node.children.map(shape),
  };
}

function run(events: TestEvent[]) {
  const store = createTreeStore();
  for (const event of events) store.apply(event);
  return store.getSnapshot();
}

// Two files, each with its own testId=1 — under process isolation this is the norm.
const fileA: TestEvent[] = [
  { type: 'test:start', data: { name: 'A root', nesting: 0, file: '/a.test.js', testId: 1 } },
  { type: 'test:start', data: { name: 'A child', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
  { type: 'test:pass', data: { name: 'A child', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
  { type: 'test:pass', data: { name: 'A root', nesting: 0, file: '/a.test.js', testId: 1, details: { type: 'suite' } } },
];
const fileB: TestEvent[] = [
  { type: 'test:start', data: { name: 'B root', nesting: 0, file: '/b.test.js', testId: 1 } },
  { type: 'test:start', data: { name: 'B child', nesting: 1, file: '/b.test.js', testId: 2, parentId: 1 } },
  { type: 'test:fail', data: { name: 'B child', nesting: 1, file: '/b.test.js', testId: 2, parentId: 1, details: { error: new Error('x') } } },
  { type: 'test:fail', data: { name: 'B root', nesting: 0, file: '/b.test.js', testId: 1, details: { type: 'suite' } } },
];

// Interleave two same-length, per-file-ordered streams (models concurrent child processes).
function interleave(a: TestEvent[], b: TestEvent[]): TestEvent[] {
  const out: TestEvent[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

test('colliding testIds across files stay distinct, grouped under their files', () => {
  const { root } = run([...fileA, ...fileB]);
  assert.strictEqual(root.children.length, 2);
  const [a, b] = root.children;
  assert.strictEqual(a.file, '/a.test.js');
  assert.strictEqual(b.file, '/b.test.js');
  assert.strictEqual(a.children[0].name, 'A root');
  assert.strictEqual(b.children[0].name, 'B root');
  assert.strictEqual(a.children[0].children[0].name, 'A child');
  assert.strictEqual(b.children[0].children[0].status, 'failed');
});

test('interleaved cross-file events produce the same tree as sequential', () => {
  const sequential = run([...fileA, ...fileB]);
  const interleaved = run(interleave(fileA, fileB));
  assert.deepStrictEqual(shape(interleaved.root), shape(sequential.root));
});

test('replaying the same events twice is idempotent', () => {
  const once = run([...fileA, ...fileB]);
  const twice = run([...fileA, ...fileB, ...fileA, ...fileB]);
  assert.deepStrictEqual(shape(twice.root), shape(once.root));
});

test('out-of-order: pass arriving before start still resolves correctly', () => {
  const ordered = run(fileA);
  const reordered = run([
    { type: 'test:pass', data: { name: 'A child', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'A root', nesting: 0, file: '/a.test.js', testId: 1, details: { type: 'suite' } } },
    { type: 'test:start', data: { name: 'A root', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'A child', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
  ]);
  assert.deepStrictEqual(shape(reordered.root), shape(ordered.root));
});

test('eager cross-file dequeue events do not create phantom queued nodes', () => {
  // Real Node emits enqueue/dequeue eagerly and out of block order: a file's
  // children can be dequeued before that file's start/pass block runs, and
  // testIds collide across files. Building nodes from those events mis-grouped
  // tests and left orphan "queued" nodes. The tree must come only from the
  // contiguous start/pass/fail blocks (delimited by per-file summaries).
  const { root, counts } = run([
    // file-level wrappers mark isolation
    { type: 'test:dequeue', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1 } },
    { type: 'test:dequeue', data: { name: 'b.test.js', nesting: 0, file: '/x/b.test.js', testId: 2 } },
    // eager dequeues for file B's children, BEFORE any block runs (colliding ids)
    { type: 'test:dequeue', data: { name: 'b1', nesting: 0, file: '/x/b.test.js', testId: 1 } },
    { type: 'test:dequeue', data: { name: 'b2', nesting: 0, file: '/x/b.test.js', testId: 2 } },
    { type: 'test:dequeue', data: { name: 'b3', nesting: 0, file: '/x/b.test.js', testId: 3 } },
    // file A block (2 tests) then its summary
    { type: 'test:start', data: { name: 'a1', nesting: 0, file: '/x/a.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'a1', nesting: 0, file: '/x/a.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'a2', nesting: 0, file: '/x/a.test.js', testId: 2 } },
    { type: 'test:pass', data: { name: 'a2', nesting: 0, file: '/x/a.test.js', testId: 2 } },
    { type: 'test:summary', data: { file: '/x/a.test.js', success: true, duration_ms: 1, counts: {} } },
    // file B block (3 tests) then its summary
    { type: 'test:start', data: { name: 'b1', nesting: 0, file: '/x/b.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'b1', nesting: 0, file: '/x/b.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'b2', nesting: 0, file: '/x/b.test.js', testId: 2 } },
    { type: 'test:pass', data: { name: 'b2', nesting: 0, file: '/x/b.test.js', testId: 2 } },
    { type: 'test:start', data: { name: 'b3', nesting: 0, file: '/x/b.test.js', testId: 3 } },
    { type: 'test:pass', data: { name: 'b3', nesting: 0, file: '/x/b.test.js', testId: 3 } },
    { type: 'test:summary', data: { file: '/x/b.test.js', success: true, duration_ms: 1, counts: {} } },
  ]);

  assert.strictEqual(root.children.length, 2);
  const [a, b] = root.children;
  assert.deepStrictEqual(a.children.map((c) => c.name), ['a1', 'a2']);
  assert.deepStrictEqual(b.children.map((c) => c.name), ['b1', 'b2', 'b3']);
  const statuses = new Set<string>();
  (function walk(n: TestNode) { statuses.add(n.status); n.children.forEach(walk); }(root));
  assert.ok(!statuses.has('queued'), 'no phantom queued nodes');
  assert.strictEqual(counts.queued, 0);
  assert.strictEqual(counts.passed, 5);
});

test('isolation=none: globally-unique testIds still group by file', () => {
  // Single process: testIds are unique across files; file is still reported per test.
  const { root } = run([
    { type: 'test:start', data: { name: 'in A', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'in B', nesting: 0, file: '/b.test.js', testId: 2 } },
    { type: 'test:pass', data: { name: 'in A', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'in B', nesting: 0, file: '/b.test.js', testId: 2 } },
  ]);
  assert.strictEqual(root.children.length, 2);
  assert.deepStrictEqual(root.children.map((f) => f.file), ['/a.test.js', '/b.test.js']);
});
