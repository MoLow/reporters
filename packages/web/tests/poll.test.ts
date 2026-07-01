import { test } from 'node:test';
import assert from 'node:assert';
import { createNdjsonReader } from '../src/poll.ts';

interface MockResponse {
  status: number;
  body: string;
}

function mockFetch(responses: MockResponse[]) {
  let call = 0;
  const ranges: (string | null)[] = [];
  const fetchImpl = async (_url: string, init?: { headers?: Record<string, string> }) => {
    ranges.push(init?.headers?.Range ?? null);
    const res = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return { status: res.status, text: async () => res.body } as unknown as Response;
  };
  return { fetchImpl, ranges };
}

test('range-supporting source returns only newly appended events', async () => {
  const { fetchImpl, ranges } = mockFetch([
    { status: 206, body: '{"type":"a"}\n{"type":"b"}\n' },
    { status: 206, body: '{"type":"c"}\n' },
  ]);
  const reader = createNdjsonReader('http://x/run.ndjson', fetchImpl);

  const first = await reader.pull();
  assert.deepStrictEqual(first.events.map((e) => e.type), ['a', 'b']);
  assert.strictEqual(first.reset, false);

  const second = await reader.pull();
  assert.deepStrictEqual(second.events.map((e) => e.type), ['c']);
  // second request asks for bytes after the first chunk
  assert.match(ranges[1]!, /^bytes=26-/);
});

test('a truncated trailing line is buffered until completed', async () => {
  const { fetchImpl } = mockFetch([
    { status: 206, body: '{"type":"a"}\n{"type":"b' },
    { status: 206, body: '"}\n' },
  ]);
  const reader = createNdjsonReader('http://x/run.ndjson', fetchImpl);

  const first = await reader.pull();
  assert.deepStrictEqual(first.events.map((e) => e.type), ['a']);

  const second = await reader.pull();
  assert.deepStrictEqual(second.events.map((e) => e.type), ['b']);
});

test('a non-range source (200) returns all events and flags a reset', async () => {
  const { fetchImpl } = mockFetch([
    { status: 200, body: '{"type":"a"}\n{"type":"b"}\n' },
  ]);
  const reader = createNdjsonReader('http://x/run.ndjson', fetchImpl);
  const result = await reader.pull();
  assert.strictEqual(result.reset, true);
  assert.deepStrictEqual(result.events.map((e) => e.type), ['a', 'b']);
});

test('blank and malformed lines are skipped, valid ones still parsed', async () => {
  const { fetchImpl } = mockFetch([
    { status: 206, body: '{"type":"a"}\n\n   \nnot json\n{"type":"b"}\n' },
  ]);
  const reader = createNdjsonReader('http://x/run.ndjson', fetchImpl);
  const { events } = await reader.pull();
  assert.deepStrictEqual(events.map((e) => e.type), ['a', 'b']);
});

test('defaults to the global fetch when none is provided', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({ status: 200, text: async () => '{"type":"z"}\n' })) as unknown as typeof fetch;
  try {
    const reader = createNdjsonReader('http://x/run.ndjson');
    const { events } = await reader.pull();
    assert.deepStrictEqual(events.map((e) => e.type), ['z']);
  } finally {
    globalThis.fetch = original;
  }
});

test('416 (nothing new) yields no events', async () => {
  const { fetchImpl } = mockFetch([
    { status: 206, body: '{"type":"a"}\n' },
    { status: 416, body: '' },
  ]);
  const reader = createNdjsonReader('http://x/run.ndjson', fetchImpl);
  await reader.pull();
  const second = await reader.pull();
  assert.deepStrictEqual(second.events, []);
  assert.strictEqual(second.reset, false);
});
