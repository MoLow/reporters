import { test } from 'node:test';
import assert from 'node:assert';
import { serializeWireLine, toWireEvent } from '../src/wire.ts';
import type { TestEvent } from '../src/types.ts';

const logEvent = (data: unknown): TestEvent => ({
  type: 'test:log',
  data: { message: 'm', data },
});

function wirePayload(data: unknown): unknown {
  return (JSON.parse(serializeWireLine(logEvent(data))) as TestEvent).data.data;
}

// A user's `t.log()` payload reaches reporters raw. Under --test-isolation=none
// a circular payload arrives with the cycle intact, and an unguarded
// JSON.stringify throws — taking down the whole run.
test('a circular log payload serializes instead of throwing', () => {
  const circ: Record<string, unknown> = { name: 'c' };
  circ.self = circ;
  assert.deepStrictEqual(wirePayload(circ), { name: 'c', self: '[Circular]' });
});

test('a payload repeated without a cycle is not mistaken for one', () => {
  const shared = { id: 1 };
  assert.deepStrictEqual(wirePayload({ a: shared, b: shared }), { a: { id: 1 }, b: { id: 1 } });
});

test('BigInt, Map, Set and Date payloads become JSON-safe', () => {
  assert.deepStrictEqual(wirePayload({
    n: 10n,
    m: new Map<string, unknown>([['a', 1]]),
    s: new Set([1, 2]),
    d: new Date(0),
  }), {
    n: '10n', m: [['a', 1]], s: [1, 2], d: '1970-01-01T00:00:00.000Z',
  });
});

test('an Error payload keeps its message, name and stack', () => {
  const payload = wirePayload({ e: new Error('boom') }) as { e: Record<string, unknown> };
  assert.strictEqual(payload.e.message, 'boom');
  assert.strictEqual(payload.e.name, 'Error');
  assert.strictEqual(typeof payload.e.stack, 'string');
});

test('functions and symbols drop out rather than serializing as null', () => {
  const payload = wirePayload({ keep: 1, f() {}, [Symbol('s')]: 2, sym: Symbol('t') }) as Record<string, unknown>;
  assert.deepStrictEqual(payload, { keep: 1 });
});

test('functions and symbols in an array become null, keeping positions', () => {
  assert.deepStrictEqual(wirePayload([1, () => {}, 3]), [1, null, 3]);
});

test('runaway depth is capped', () => {
  let deep: unknown = 'leaf';
  for (let i = 0; i < 40; i += 1) deep = { deep };
  const line = serializeWireLine(logEvent(deep));
  assert.ok(line.length < 400, `expected a capped payload, got ${line.length} chars`);
  assert.ok(line.includes('[Truncated]'));
});

test('a runaway node count is capped', () => {
  const wide = Array.from({ length: 5000 }, (_, i) => i);
  const payload = wirePayload(wide) as unknown[];
  assert.ok(payload.length < 5000, `expected truncation, got ${payload.length} entries`);
});

test('a primitive payload passes through unchanged', () => {
  assert.strictEqual(wirePayload('hello'), 'hello');
  assert.strictEqual(wirePayload(42), 42);
  assert.strictEqual(wirePayload(true), true);
  assert.strictEqual(wirePayload(null), null);
});

test('non-finite numbers survive as strings rather than JSON null', () => {
  assert.deepStrictEqual(wirePayload({ a: NaN, b: Infinity, c: -Infinity }), { a: 'NaN', b: 'Infinity', c: '-Infinity' });
});

test('an absent payload adds no data field', () => {
  const wire = toWireEvent({ type: 'test:log', data: { message: 'm' } });
  assert.ok(!('data' in wire.data), 'no data key for a payloadless log');
});

test('an explicitly undefined payload adds no data field', () => {
  const wire = toWireEvent({ type: 'test:log', data: { message: 'm', data: undefined } });
  assert.ok(!('data' in wire.data), 'no data key for an undefined payload');
});

test('a runaway object key count is capped', () => {
  const wide: Record<string, number> = {};
  for (let i = 0; i < 5000; i += 1) wide[`k${i}`] = i;
  const payload = wirePayload(wide) as Record<string, unknown>;
  assert.strictEqual(payload['[Truncated]'], true);
  assert.ok(Object.keys(payload).length < 5000, 'expected truncation');
});
