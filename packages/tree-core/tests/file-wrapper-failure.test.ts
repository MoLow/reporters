// A file can fail even when every test inside it passed — a hook threw or the
// child process exited non-zero — and node reports that only on the file-level
// wrapper (test:complete passed:false, then test:fail). The wrapper's own
// result must reach the file's status, error, and the counts, or the run
// renders fully green while node's summary says it failed. Distilled from a
// real isolated run (scheduledBackup.test.ts, eon-service run 28847073806).
import { test } from 'node:test';
import assert from 'node:assert';
import { build, done, ev } from './util.ts';

const ENTRY = '/x/tests/scheduled.test.ts';
const WRAP = { name: 'tests/scheduled.test.ts', nesting: 0, file: ENTRY, testId: 9, parentId: 0, type: 'test' as const };
const failed = { passed: false, duration_ms: 2, error: { message: 'test failed', name: 'Error' } };

test('a wrapper that fails with all children passed marks the file failed', () => {
  const stream = [
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
    ev('test:complete', { ...WRAP, details: failed }),
  ];
  const mid = build(stream);
  const midFile = mid.root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(midFile.status, 'failed', 'the wrapper closed failed; the file cannot read passed');
  assert.strictEqual(mid.counts.failed, 1, 'the wrapper\'s own failure is a failed test');
  assert.strictEqual(mid.counts.total, 2);
  assert.strictEqual(midFile.error?.message, 'test failed');

  const end = build([
    ...stream,
    ev('test:start', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0 }),
    ev('test:pass', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
    ev('test:start', WRAP),
    ev('test:fail', { ...WRAP, details: { duration_ms: 2, error: { message: 'test failed', name: 'Error' } } }),
    ev('test:summary', { file: ENTRY, duration_ms: 5 }),
  ]);
  const endFile = end.root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(endFile.status, 'failed');
  assert.strictEqual(end.counts.failed, 1);
  assert.strictEqual(end.counts.passed, 1);
  assert.strictEqual(end.counts.total, 2);
});

test('a wrapper failing because a child failed does not double-count', () => {
  const { root, counts } = build([
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: failed }),
    ev('test:complete', { ...WRAP, details: { ...failed, error: { message: '1 subtest failed', name: 'Error' } } }),
    ev('test:summary', { file: ENTRY, duration_ms: 5 }),
  ]);
  const file = root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(file.status, 'failed');
  assert.strictEqual(counts.failed, 1, 'the failing leaf is the failure; the wrapper echoes it');
  assert.strictEqual(counts.total, 1);
  assert.strictEqual(file.error?.message, '1 subtest failed', 'the wrapper\'s own error stays on the node even when a child failed');
});

test('a wrapper that closes passed leaves the file passed', () => {
  const { root, counts } = build([
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
    ev('test:complete', { ...WRAP, details: done }),
    ev('test:summary', { file: ENTRY, duration_ms: 5 }),
  ]);
  const file = root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(file.status, 'passed');
  assert.strictEqual(counts.failed, 0);
  assert.strictEqual(counts.total, 1);
});
