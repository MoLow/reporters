import { test } from 'node:test';
import assert from 'node:assert';
import { toWireEvent } from '../src/wire.ts';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent } from '../src/types.ts';

function apply(store: ReturnType<typeof createTreeStore>, events: TestEvent[]) {
  for (const event of events) store.apply(event);
}

test('toWireEvent preserves rerun details fields', () => {
  const wired = toWireEvent({
    type: 'test:pass',
    data: {
      name: 'adds', nesting: 0, file: '/a.test.js', testId: 1,
      details: { duration_ms: 14, attempt: 1, passed_on_attempt: 0 },
    },
  });
  assert.strictEqual(wired.data.details?.attempt, 1);
  assert.strictEqual(wired.data.details?.passed_on_attempt, 0);
});

test('toWireEvent omits absent rerun fields', () => {
  const wired = toWireEvent({
    type: 'test:pass',
    data: { name: 'adds', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 14 } },
  });
  assert.ok(!('attempt' in wired.data.details!));
  assert.ok(!('passed_on_attempt' in wired.data.details!));
});

test('carried pass stamps passedOnAttempt and counts carried up the tree', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'carried one', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'carried one', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 14, attempt: 1, passed_on_attempt: 0 } } },
    { type: 'test:start', data: { name: 'fresh one', nesting: 0, file: '/a.test.js', testId: 2 } },
    { type: 'test:pass', data: { name: 'fresh one', nesting: 0, file: '/a.test.js', testId: 2, details: { duration_ms: 3, attempt: 1 } } },
  ]);
  const snap = store.getSnapshot();
  const [carried, fresh] = snap.root.children[0].children;
  assert.strictEqual(carried.passedOnAttempt, 0);
  assert.strictEqual(fresh.passedOnAttempt, undefined);
  assert.strictEqual(snap.counts.carried, 1);
  assert.strictEqual(snap.counts.passed, 2);
  assert.strictEqual(snap.root.children[0].counts.carried, 1);
  assert.strictEqual(snap.attempt, 1);
});

test('non-rerun stream has no attempt and zero carried', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'adds', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'adds', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 5 } } },
  ]);
  const snap = store.getSnapshot();
  assert.strictEqual(snap.attempt, undefined);
  assert.strictEqual(snap.counts.carried, 0);
  assert.strictEqual(snap.root.children[0].children[0].passedOnAttempt, undefined);
});

test('a carried replayed duration does not backdate the run clock', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:pass', t: 1000000, data: { name: 'carried', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 900000, attempt: 1, passed_on_attempt: 0 } } },
  ]);
  const snap = store.getSnapshot();
  assert.deepStrictEqual(snap.clock, { firstT: 1000000, lastT: 1000000 });
});

test('a fresh finish without a start still backdates the run clock', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:pass', t: 1000000, data: { name: 'fresh', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 900000, attempt: 1 } } },
  ]);
  assert.strictEqual(store.getSnapshot().clock?.firstT, 100000);
});
