import { test } from 'node:test';
import assert from 'node:assert';
import type { TestEvent } from '@reporters/tree-core';
import type { Sink } from '../src/sink.ts';
import type { MuxConfig } from '../src/types.ts';
import { resolveReporter, runRoutes } from '../src/index.ts';

const events: TestEvent[] = [
  { type: 'test:pass', data: { name: 'a', nesting: 0, testId: 1 } },
  { type: 'test:pass', data: { name: 'b', nesting: 0, testId: 2 } },
];

async function* source(): AsyncGenerator<TestEvent> {
  for (const e of events) yield e;
}

// A trivial reporter: one output line per event, tagged so we can tell routes apart.
function tagReporter(tag: string) {
  return async function* (src: AsyncIterable<TestEvent>): AsyncGenerator<string> {
    for await (const e of src) yield `${tag}:${e.type}\n`;
  };
}

function memorySink(): Sink & { data: string } {
  const sink = { data: '', write(c: string | Buffer) { sink.data += String(c); }, async close() {} };
  return sink;
}

test('resolveReporter returns a function as-is', async () => {
  const fn = tagReporter('x');
  assert.strictEqual(await resolveReporter(fn), fn);
});

test('runRoutes tees events to every route and pipes bytes to each sink', async () => {
  const a = memorySink();
  const b = memorySink();
  const config: MuxConfig = {
    local: [
      { reporter: tagReporter('A'), sink: a },
      { reporter: tagReporter('B'), sink: b },
    ],
  };
  await runRoutes(source(), config, { REPORTERS_OPEN: '0' });
  assert.strictEqual(a.data, 'A:test:pass\nA:test:pass\n');
  assert.strictEqual(b.data, 'B:test:pass\nB:test:pass\n');
});

test('runRoutes opens the sink viewer URL when the gate allows it', async () => {
  const opened: string[] = [];
  const viewerSink: Sink = { write() {}, async close() {}, viewerUrl: () => 'http://localhost:1234/' };
  const config: MuxConfig = { local: [{ reporter: tagReporter('V'), sink: viewerSink }] };
  await runRoutes(source(), config, {}, (url) => opened.push(url));
  assert.deepStrictEqual(opened, ['http://localhost:1234/']);
});
