import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent } from '../src/types.ts';

function apply(store: ReturnType<typeof createTreeStore>, events: TestEvent[]) {
  for (const event of events) store.apply(event);
}

test('a single passing top-level test builds root > file > test', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'adds', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'adds', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 5 } } },
  ]);

  const { root } = store.getSnapshot();
  assert.strictEqual(root.children.length, 1);

  const fileNode = root.children[0];
  assert.strictEqual(fileNode.type, 'file');
  assert.strictEqual(fileNode.file, '/a.test.js');
  assert.strictEqual(fileNode.children.length, 1);

  const testNode = fileNode.children[0];
  assert.strictEqual(testNode.type, 'test');
  assert.strictEqual(testNode.name, 'adds');
  assert.strictEqual(testNode.status, 'passed');
  assert.strictEqual(testNode.durationMs, 5);
});

test('nested suite with subtests aggregates counts on the suite, not double-counting', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'math', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'adds', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'adds', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1, details: { duration_ms: 1 } } },
    { type: 'test:start', data: { name: 'subtracts', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1 } },
    { type: 'test:fail', data: { name: 'subtracts', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1, details: { duration_ms: 1, error: new Error('boom') } } },
    { type: 'test:fail', data: { name: 'math', nesting: 0, file: '/a.test.js', testId: 1, parentId: undefined, details: { duration_ms: 3, type: 'suite' } } },
  ]);

  const { root, counts } = store.getSnapshot();
  const suite = root.children[0].children[0];
  assert.strictEqual(suite.type, 'suite');
  assert.strictEqual(suite.children.length, 2);
  assert.deepStrictEqual(
    { passed: suite.counts.passed, failed: suite.counts.failed, total: suite.counts.total },
    { passed: 1, failed: 1, total: 2 },
  );
  // overall counts the two leaves, not the suite itself
  assert.deepStrictEqual({ passed: counts.passed, failed: counts.failed, total: counts.total }, { passed: 1, failed: 1, total: 2 });
});

test('failed test carries the unwrapped cause error', () => {
  const store = createTreeStore();
  const cause = new Error('actual failure');
  const wrapper = new Error('wrapper');
  // @ts-expect-error test cause shape
  wrapper.cause = cause;
  apply(store, [
    { type: 'test:start', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:fail', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1, details: { error: wrapper } } },
  ]);
  const node = store.getSnapshot().root.children[0].children[0];
  assert.strictEqual(node.status, 'failed');
  assert.strictEqual(node.error?.message, 'actual failure');
});

test('skip maps to its own status; todo status is reserved for failing todos', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:pass', data: { name: 's', nesting: 0, file: '/a.test.js', testId: 1, skip: true } },
    { type: 'test:pass', data: { name: 'green', nesting: 0, file: '/a.test.js', testId: 2, todo: true } },
    { type: 'test:fail', data: { name: 'red', nesting: 0, file: '/a.test.js', testId: 3, todo: 'evaluating', details: { error: new Error('boom') } } },
  ]);
  const [s, green, red] = store.getSnapshot().root.children[0].children;
  assert.strictEqual(s.status, 'skipped');
  // A todo that actually passes reports as passed — it is a candidate to
  // un-todo — and keeps its todo marker; a failing todo is the expected
  // state and must not fail the run.
  assert.strictEqual(green.status, 'passed');
  assert.strictEqual(green.todo, true);
  assert.strictEqual(red.status, 'todo');
  assert.strictEqual(red.error?.message, 'boom');
});

test('test:complete resolves a todo result ahead of the buffered pass/fail', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:complete', data: { name: 'green', nesting: 0, file: '/a.test.js', testId: 1, parentId: 0, todo: true, details: { passed: true } } },
    { type: 'test:complete', data: { name: 'red', nesting: 0, file: '/a.test.js', testId: 2, parentId: 0, todo: true, details: { passed: false, error: new Error('boom') } } },
  ]);
  const [green, red] = store.getSnapshot().root.children[0].children;
  assert.strictEqual(green.status, 'passed');
  assert.strictEqual(red.status, 'todo');
});

test('diagnostics attach to the last started test at that file+nesting', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:diagnostic', data: { message: 'hello', nesting: 0, file: '/a.test.js', level: 'info' } },
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
  ]);
  const node = store.getSnapshot().root.children[0].children[0];
  assert.deepStrictEqual(node.diagnostics, [{ message: 'hello', level: 'info' }]);
});

test('stdout and stderr attach to the file node', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:stdout', data: { file: '/a.test.js', message: 'out\n' } },
    { type: 'test:stderr', data: { file: '/a.test.js', message: 'err\n' } },
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
  ]);
  const fileNode = store.getSnapshot().root.children[0];
  assert.deepStrictEqual(fileNode.stdout, ['out\n']);
  assert.deepStrictEqual(fileNode.stderr, ['err\n']);
});

test('overall summary is captured from the root test:summary', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:summary', data: { file: undefined, success: true, duration_ms: 12, counts: { passed: 1, failed: 0, tests: 1 } } },
  ]);
  const { summary } = store.getSnapshot();
  assert.strictEqual(summary?.success, true);
  assert.strictEqual(summary?.durationMs, 12);
  assert.strictEqual(summary?.counts.passed, 1);
});

test('under isolation, a per-file summary does not overwrite the overall summary', () => {
  const store = createTreeStore();
  apply(store, [
    // a file-level wrapper marks the run as isolated (multi-process / --test)
    { type: 'test:dequeue', data: { name: 'a.test.js', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:summary', data: { file: '/a.test.js', success: false, duration_ms: 1, counts: {} } },
  ]);
  assert.strictEqual(store.getSnapshot().summary, undefined);
});

test('without file wrappers (no --test), the single file summary is the overall summary', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:summary', data: { file: '/a.test.js', success: true, duration_ms: 9, counts: { passed: 1 } } },
  ]);
  assert.strictEqual(store.getSnapshot().summary?.success, true);
  assert.strictEqual(store.getSnapshot().summary?.durationMs, 9);
});

test('with testId but no parentId, hierarchy falls back to the nesting stack', () => {
  // Models a Node build that emits testId but not parentId (e.g. 26.2.x).
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'child', nesting: 1, file: '/a.test.js', testId: 2 } },
    { type: 'test:pass', data: { name: 'child', nesting: 1, file: '/a.test.js', testId: 2 } },
    { type: 'test:pass', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1, details: { type: 'suite' } } },
  ]);
  const suite = store.getSnapshot().root.children[0].children[0];
  assert.strictEqual(suite.name, 'suite');
  assert.strictEqual(suite.children.length, 1);
  assert.strictEqual(suite.children[0].name, 'child');
});

test('test:complete finalizes tests in execution order, before the buffered pass', () => {
  // test:complete is execution-ordered; a later-declared test that finishes
  // first must show done while the earlier one is still running (the live-order
  // guarantee that test:pass — declaration-ordered — cannot provide).
  const store = createTreeStore();
  apply(store, [
    { type: 'test:dequeue', data: { name: 'slow', nesting: 0, file: '/t.test.js', testId: 1, parentId: 0 } },
    { type: 'test:dequeue', data: { name: 'fast', nesting: 0, file: '/t.test.js', testId: 2, parentId: 0 } },
    { type: 'test:complete', data: { name: 'fast', nesting: 0, file: '/t.test.js', testId: 2, parentId: 0, details: { passed: true, duration_ms: 5 } } },
  ]);
  const [slow, fast] = store.getSnapshot().root.children[0].children;
  assert.strictEqual(slow.status, 'running');
  assert.strictEqual(fast.status, 'passed');
  assert.strictEqual(fast.durationMs, 5);
});

test('test:complete carries failure and skip/todo status', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:complete', data: { name: 'boom', nesting: 0, file: '/t.test.js', testId: 1, parentId: 0, details: { passed: false, error: new Error('nope') } } },
    { type: 'test:complete', data: { name: 'skipped', nesting: 0, file: '/t.test.js', testId: 2, parentId: 0, skip: true, details: { passed: true } } },
    { type: 'test:complete', data: { name: 'todo', nesting: 0, file: '/t.test.js', testId: 3, parentId: 0, todo: true, details: { passed: false } } },
  ]);
  const [boom, skipped, todo] = store.getSnapshot().root.children[0].children;
  assert.strictEqual(boom.status, 'failed');
  assert.strictEqual(boom.error?.message, 'nope');
  assert.strictEqual(skipped.status, 'skipped');
  assert.strictEqual(todo.status, 'todo');
});

test('tests appear as running from dequeue, before start/pass arrive', () => {
  // Concurrent tests are all dequeued eagerly (before their reportOrder turn),
  // so the live tree must show them running immediately from dequeue alone.
  const store = createTreeStore();
  store.apply({ type: 'test:dequeue', data: { name: 'slow', nesting: 0, file: '/t.test.js', testId: 1, parentId: 0 } });
  store.apply({ type: 'test:dequeue', data: { name: 'fast', nesting: 0, file: '/t.test.js', testId: 2, parentId: 0 } });
  const file = store.getSnapshot().root.children[0];
  assert.strictEqual(file.children.length, 2);
  assert.deepStrictEqual(file.children.map((c) => [c.name, c.status]), [['slow', 'running'], ['fast', 'running']]);
});

test('the file wrapper completion carries the file wall-clock onto the file node', () => {
  // Concurrent tests inside a file sum to far more than the file's real
  // duration; the wrapper's test:complete measures the actual wall-clock.
  const store = createTreeStore();
  apply(store, [
    { type: 'test:enqueue', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0 } },
    { type: 'test:complete', data: { name: 'fast', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0, details: { passed: true, duration_ms: 500 } } },
    { type: 'test:complete', data: { name: 'slow', nesting: 0, file: '/x/a.test.js', testId: 2, parentId: 0, details: { passed: true, duration_ms: 600 } } },
    { type: 'test:complete', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0, details: { passed: true, duration_ms: 700 } } },
  ]);
  const fileNode = store.getSnapshot().root.children[0];
  assert.strictEqual(fileNode.type, 'file');
  assert.strictEqual(fileNode.durationMs, 700);
});

test('a file wrapper pass carries the wall-clock but never overrides the completion detail', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/x/a.test.js', testId: 1, details: { duration_ms: 50 } } },
    { type: 'test:pass', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0, details: { duration_ms: 80 } } },
  ]);
  assert.strictEqual(store.getSnapshot().root.children[0].durationMs, 80);

  const withComplete = createTreeStore();
  apply(withComplete, [
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/x/a.test.js', testId: 1, details: { duration_ms: 50 } } },
    { type: 'test:complete', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0, details: { passed: true, duration_ms: 70 } } },
    { type: 'test:pass', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0, details: { duration_ms: 90 } } },
    { type: 'test:summary', data: { file: '/x/a.test.js', success: true, duration_ms: 95, counts: {} } },
  ]);
  assert.strictEqual(withComplete.getSnapshot().root.children[0].durationMs, 70);
});

test('a per-file summary carries the file wall-clock when no wrapper completion has detail', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:dequeue', data: { name: 'a.test.js', nesting: 0, file: '/x/a.test.js', testId: 1, parentId: 0 } },
    { type: 'test:pass', data: { name: 't', nesting: 0, file: '/x/a.test.js', testId: 1, details: { duration_ms: 50 } } },
    { type: 'test:summary', data: { file: '/x/a.test.js', success: true, duration_ms: 90, counts: {} } },
  ]);
  const fileNode = store.getSnapshot().root.children[0];
  assert.strictEqual(fileNode.durationMs, 90);
});

test('REPL-shaped events without file or nesting build under the <repl> group', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:enqueue', data: { name: 'eager', testId: 3, parentId: 0 } },
    { type: 'test:complete', data: { name: 'eager', testId: 3, parentId: 0, details: { passed: true } } },
    { type: 'test:start', data: { name: 'outer', testId: 1, parentId: 0 } },
    { type: 'test:start', data: { name: 'inner', nesting: 1, testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'inner', nesting: 1, testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'outer', testId: 1, parentId: 0 } },
    { type: 'test:diagnostic', data: { message: 'note' } },
  ]);
  const { root } = store.getSnapshot();
  assert.strictEqual(root.children.length, 1);
  const group = root.children[0];
  assert.strictEqual(group.name, '<repl>');
  assert.deepStrictEqual(group.children.map((c) => [c.name, c.status]), [['eager', 'passed'], ['outer', 'passed']]);
  const outer = group.children[1];
  assert.deepStrictEqual(outer.children.map((c) => c.name), ['inner']);
});

test('subscribe is notified on apply and stops after unsubscribe', () => {
  const store = createTreeStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.apply({ type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } });
  assert.strictEqual(calls, 1);
  unsubscribe();
  store.apply({ type: 'test:pass', data: { name: 'u', nesting: 0, file: '/a.test.js', testId: 2 } });
  assert.strictEqual(calls, 1);
});

test('a leaf test stays a test when its dequeue wrongly reports the parent suite type (nodejs/node dequeue bug)', () => {
  // Node's processPendingSubtests dequeues queued subtests with the PARENT's
  // reportedType, so a plain test() queued inside a describe() dequeues as
  // type 'suite'. The terminal events carry the test's real type — trust them.
  const store = createTreeStore();
  apply(store, [
    { type: 'test:enqueue', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1, parentId: 0, type: 'suite' } },
    { type: 'test:dequeue', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1, parentId: 0, type: 'suite' } },
    { type: 'test:enqueue', data: { name: 'first', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1, type: 'test' } },
    { type: 'test:enqueue', data: { name: 'queued', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1, type: 'test' } },
    { type: 'test:complete', data: { name: 'first', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1, details: { duration_ms: 1, type: 'test', passed: true } } },
    { type: 'test:dequeue', data: { name: 'queued', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1, type: 'suite' } },
    { type: 'test:complete', data: { name: 'queued', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1, details: { duration_ms: 1, type: 'test', passed: true } } },
    { type: 'test:complete', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1, parentId: 0, details: { duration_ms: 2, type: 'suite', passed: true } } },
    { type: 'test:start', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1, parentId: 0 } },
    { type: 'test:start', data: { name: 'first', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'first', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1, details: { duration_ms: 1, type: 'test' } } },
    { type: 'test:start', data: { name: 'queued', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1 } },
    { type: 'test:pass', data: { name: 'queued', nesting: 1, file: '/a.test.js', testId: 3, parentId: 1, details: { duration_ms: 1, type: 'test' } } },
    { type: 'test:pass', data: { name: 'suite', nesting: 0, file: '/a.test.js', testId: 1, parentId: 0, details: { duration_ms: 2, type: 'suite' } } },
  ]);
  const suite = store.getSnapshot().root.children[0].children[0];
  assert.strictEqual(suite.type, 'suite');
  assert.deepStrictEqual(suite.children.map((c) => [c.name, c.type, c.status]), [
    ['first', 'test', 'passed'],
    ['queued', 'test', 'passed'],
  ]);
});

test('testId-free results settle the node type from details.type (v22-shaped)', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'group', nesting: 0, file: '/a.test.js' } },
    { type: 'test:start', data: { name: 'leaf', nesting: 1, file: '/a.test.js' } },
    { type: 'test:pass', data: { name: 'leaf', nesting: 1, file: '/a.test.js', details: { duration_ms: 1, type: 'test' } } },
    { type: 'test:pass', data: { name: 'group', nesting: 0, file: '/a.test.js', details: { duration_ms: 2, type: 'suite' } } },
  ]);
  const group = store.getSnapshot().root.children[0].children[0];
  assert.strictEqual(group.type, 'suite');
  assert.deepStrictEqual(group.children.map((c) => [c.name, c.type]), [['leaf', 'test']]);
});
