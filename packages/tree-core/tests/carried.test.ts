import { test } from 'node:test';
import assert from 'node:assert';
import { toWireEvent } from '../src/wire.ts';

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
