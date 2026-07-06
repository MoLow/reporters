import { test } from 'node:test';
import assert from 'node:assert';
import { toWireEvent } from '../src/wire.ts';
import { createTreeStore } from '../src/store.ts';
import { isCarried, carriedAttempt } from '../src/carried.ts';
import type { Counts, TestEvent, TestNode } from '../src/types.ts';

function apply(store: ReturnType<typeof createTreeStore>, events: TestEvent[]) {
  for (const event of events) store.apply(event);
}

const zero = (): Counts => ({
  passed: 0, failed: 0, skipped: 0, todo: 0, running: 0, queued: 0, carried: 0, total: 0,
});

function leaf(over: Partial<TestNode> = {}): TestNode {
  return {
    key: 'k', testId: undefined, parentKey: null, file: undefined, name: '',
    nesting: 0, type: 'test', status: 'passed', diagnostics: [], stdout: [], stderr: [],
    children: [], counts: { ...zero(), passed: 1, total: 1 }, ...over,
  };
}

function container(children: TestNode[]): TestNode {
  const counts = zero();
  for (const c of children) {
    counts.passed += c.counts.passed;
    counts.carried += c.counts.carried;
    counts.total += c.counts.total;
  }
  return { ...leaf({ type: 'suite' }), children, counts };
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

test('isCarried: leaf by passedOnAttempt, container by all-carried counts', () => {
  const carried0 = leaf({ passedOnAttempt: 0, counts: { ...zero(), passed: 1, carried: 1, total: 1 } });
  const fresh = leaf();
  assert.strictEqual(isCarried(carried0), true);
  assert.strictEqual(isCarried(fresh), false);
  assert.strictEqual(isCarried(container([carried0, carried0])), true);
  assert.strictEqual(isCarried(container([carried0, fresh])), false);
  assert.strictEqual(isCarried(container([fresh, fresh])), false);
});

test('carriedAttempt: uniform value or undefined', () => {
  const a0 = leaf({ passedOnAttempt: 0, counts: { ...zero(), passed: 1, carried: 1, total: 1 } });
  const a1 = leaf({ passedOnAttempt: 1, counts: { ...zero(), passed: 1, carried: 1, total: 1 } });
  const fresh = leaf();
  assert.strictEqual(carriedAttempt(container([a0, a0])), 0);
  assert.strictEqual(carriedAttempt(container([a0, a1])), undefined);
  assert.strictEqual(carriedAttempt(a1), 1);
  // Non-carried leaves don't participate; siblings after a detected mix are skipped.
  assert.strictEqual(carriedAttempt(container([fresh, a1])), 1);
  assert.strictEqual(carriedAttempt(container([container([a0, a1]), a0])), undefined);
});
