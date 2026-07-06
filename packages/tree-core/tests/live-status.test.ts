// A parent test still executing is itself a running test: its own status must
// reach the counts and the file rollup even when every subtest it has produced
// so far is settled — otherwise the live tree shows ✓ and flips back to
// running when the next subtest arrives, and the header reads "Running" with
// no running row in sight. Same for a file whose wrapper hasn't completed.
// Distilled from a real isolated run (mongoAtlas.test.ts, 39-minute parent).
import { test } from 'node:test';
import assert from 'node:assert';
import { build, done, ev } from './util.ts';

const ENTRY = '/x/tests/atlas.test.ts';
const WRAP = { name: 'tests/atlas.test.ts', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' as const };

test('a running parent with settled children counts and rolls up as running', () => {
  const { root, counts } = build([
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' }),
    ev('test:dequeue', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' }),
    ev('test:complete', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, details: done }),
  ]);
  const file = root.children.find((n) => n.type === 'file')!;
  const parent = file.children.find((n) => n.name === 'backup on demand')!;
  assert.strictEqual(parent.status, 'running', 'the parent is still executing');
  assert.strictEqual(counts.running, 1, 'the running parent is a running test');
  assert.strictEqual(counts.total, 2, 'the running parent counts toward the total');
  assert.strictEqual(file.status, 'running', 'the file cannot be done while a parent runs');
});

test('a running suite with settled children counts and rolls up as running', () => {
  const { root, counts } = build([
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'Atlas', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'suite' }),
    ev('test:dequeue', { name: 'Atlas', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'suite' }),
    ev('test:enqueue', { name: 'scan cluster', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' }),
    ev('test:dequeue', { name: 'scan cluster', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' }),
    ev('test:complete', { name: 'scan cluster', nesting: 1, file: ENTRY, testId: 2, parentId: 1, details: done }),
  ]);
  const file = root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(counts.running, 1);
  assert.strictEqual(file.status, 'running');
});

test('a file stays running until its wrapper completes', () => {
  const stream = [
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
  ];
  const mid = build(stream);
  const midFile = mid.root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(midFile.status, 'running', 'all tests settled, but the wrapper is still open');

  const end = build([
    ...stream,
    ev('test:complete', { ...WRAP, details: done }),
    ev('test:start', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0 }),
    ev('test:pass', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
    ev('test:summary', { file: ENTRY, duration_ms: 5 }),
  ]);
  const endFile = end.root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(endFile.status, 'passed');
  assert.strictEqual(end.counts.running, 0);
});

test('a file-level start opens the wrapper too (streams without eager wrapper events)', () => {
  const { root } = build([
    ev('test:start', WRAP),
    ev('test:enqueue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'only test', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
  ]);
  const file = root.children.find((n) => n.type === 'file')!;
  assert.strictEqual(file.status, 'running', 'the wrapper started and has not completed');
});

test('settled parents leave the final counts as leaves-only', () => {
  const { counts } = build([
    ev('test:enqueue', WRAP),
    ev('test:dequeue', WRAP),
    ev('test:enqueue', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' }),
    ev('test:dequeue', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, type: 'test' }),
    ev('test:complete', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, details: done }),
    ev('test:complete', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
    ev('test:complete', { ...WRAP, details: done }),
    ev('test:start', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0 }),
    ev('test:start', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1 }),
    ev('test:pass', { name: 'validate snapshot', nesting: 1, file: ENTRY, testId: 2, parentId: 1, details: done }),
    ev('test:pass', { name: 'backup on demand', nesting: 0, file: ENTRY, testId: 1, parentId: 0, details: done }),
    ev('test:summary', { file: ENTRY, duration_ms: 5 }),
  ]);
  assert.strictEqual(counts.total, 1, 'a settled parent is not counted; only its leaves are');
  assert.strictEqual(counts.passed, 1);
  assert.strictEqual(counts.running, 0);
});
