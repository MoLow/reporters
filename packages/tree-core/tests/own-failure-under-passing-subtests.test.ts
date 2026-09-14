// A test whose own body fails AFTER its subtests passed is a failed node with
// no failed leaf under it. Counts are leaves-only, so nothing in the subtree
// records the failure and every ancestor rolls up green — the run renders fully
// passing while node's summary says it failed. Distilled from a real run
// (s3.test.ts "should scan s3", eon-service run 34725946741).
import { test } from 'node:test';
import assert from 'node:assert';
import { build, captureEvents, done, ev, findOne } from './util.ts';

const ENTRY = '/x/tests/s3.test.ts';
const WRAP = { name: 'tests/s3.test.ts', nesting: 0, file: ENTRY, testId: 9, parentId: 0, type: 'test' as const };
const PARENT = { name: 'should scan s3', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' as const };
const CHILD = { name: 'should detect annotations', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' as const };
const boom = { message: 'not indexed yet', name: 'Error' };

test('a test failing in its own body after its subtests passed counts as failed', () => {
  const { root, counts } = build([
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', PARENT),
    ev('test:dequeue', PARENT),
    ev('test:enqueue', CHILD),
    ev('test:dequeue', CHILD),
    ev('test:complete', { ...CHILD, details: done }),
    ev('test:start', PARENT),
    ev('test:start', CHILD),
    ev('test:pass', { ...CHILD, details: done }),
    ev('test:complete', { ...PARENT, details: { passed: false, duration_ms: 3, error: boom } }),
    ev('test:fail', { ...PARENT, details: { duration_ms: 3, error: boom } }),
    ev('test:complete', { ...WRAP, details: { passed: false, duration_ms: 4, error: { message: 'test failed', name: 'Error' } } }),
    ev('test:summary', { file: ENTRY, duration_ms: 5 }),
  ]);

  const parent = findOne(root, 'should scan s3').node;
  assert.strictEqual(parent.status, 'failed');
  assert.strictEqual(parent.counts.failed, 1, 'the failing parent is itself a failure, not only a container');
  assert.strictEqual(parent.counts.passed, 1, 'its passing subtest still counts');
  assert.strictEqual(parent.counts.total, 2);

  const file = root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(file.status, 'failed');
  assert.strictEqual(counts.failed, 1, 'the wrapper echoes the parent; it must not add a second failure');
  assert.strictEqual(counts.passed, 1);
  assert.strictEqual(counts.total, 2);
});

test('the same shape captured from a real runner', () => {
  const { root, counts } = build(captureEvents(['fixtures/own-failure-after-subtest.mjs']));
  const parent = findOne(root, 'parent that fails after its subtest passed').node;
  assert.strictEqual(parent.status, 'failed');
  assert.strictEqual(parent.counts.failed, 1);
  assert.strictEqual(counts.failed, 1);
  assert.strictEqual(counts.passed, 1);
});
