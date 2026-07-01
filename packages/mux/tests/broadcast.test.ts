import { test } from 'node:test';
import assert from 'node:assert';
import { broadcast } from '../src/broadcast.ts';

async function* nums(): AsyncGenerator<number> {
  yield 1; yield 2; yield 3;
}

async function drain<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of it) out.push(v);
  return out;
}

test('every consumer receives every item', async () => {
  const [a, b] = broadcast(nums(), 2);
  const [ra, rb] = await Promise.all([drain(a), drain(b)]);
  assert.deepStrictEqual(ra, [1, 2, 3]);
  assert.deepStrictEqual(rb, [1, 2, 3]);
});

test('a slow consumer still receives all items after a fast one finishes', async () => {
  const [fast, slow] = broadcast(nums(), 2);
  const rFast = await drain(fast);            // consume fast fully first
  const rSlow = await drain(slow);            // then the slow one
  assert.deepStrictEqual(rFast, [1, 2, 3]);
  assert.deepStrictEqual(rSlow, [1, 2, 3]);
});

test('broadcast(source, 0) returns an empty array', () => {
  assert.deepStrictEqual(broadcast(nums(), 0), []);
});

test('n=1: a single consumer receives all items in order', async () => {
  const [only] = broadcast(nums(), 1);
  assert.deepStrictEqual(await drain(only), [1, 2, 3]);
});

test('a source error surfaces after buffered values drain', async () => {
  async function* boom(): AsyncGenerator<number> {
    yield 1;
    throw new Error('kaboom');
  }
  const [only] = broadcast(boom(), 1);
  const seen: number[] = [];
  await assert.rejects(async () => {
    for await (const v of only) seen.push(v);
  }, /kaboom/);
  assert.deepStrictEqual(seen, [1]);
});

test('a next() call after the source has already failed rejects', async () => {
  async function* boom(): AsyncGenerator<number> {
    throw new Error('immediate');
  }
  const [only] = broadcast(boom(), 1);
  // Let the pump run and fail before we pull, so next() hits the failed check
  // (rather than being resolved as a pending waiter).
  await new Promise((resolve) => { setImmediate(resolve); });
  const it = only[Symbol.asyncIterator]();
  await assert.rejects(() => it.next(), /immediate/);
});
