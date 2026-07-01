import { test } from 'node:test';
import assert from 'node:assert';
import { Transform } from 'node:stream';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { TestEvent } from '@reporters/tree-core';
import type { Sink } from '../src/sink.ts';
import type { MuxConfig } from '../src/types.ts';
import mux, { resolveReporter, runRoutes } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

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

test('runRoutes flushes a sink that implements flush() after the reporter completes', async () => {
  const events2: string[] = [];
  const sink: Sink = {
    write(c) { events2.push(`w:${String(c).trim()}`); },
    async flush() { events2.push('flush'); },
    async close() { events2.push('close'); },
  };
  const config: MuxConfig = { local: [{ reporter: tagReporter('F'), sink }] };
  await runRoutes(source(), config, { REPORTERS_OPEN: '0' });
  // flush runs after the last write and before close.
  assert.deepStrictEqual(events2, ['w:F:test:pass', 'w:F:test:pass', 'flush', 'close']);
});

test('runRoutes opens the sink viewer URL when the gate allows it', async () => {
  const opened: string[] = [];
  const viewerSink: Sink = { write() {}, async close() {}, viewerUrl: () => 'http://localhost:1234/' };
  const config: MuxConfig = { local: [{ reporter: tagReporter('V'), sink: viewerSink }] };
  await runRoutes(source(), config, {}, (url) => opened.push(url));
  assert.deepStrictEqual(opened, ['http://localhost:1234/']);
});

// A Transform-based reporter (the shape @reporters/gh uses): objectMode in, string out.
function tagTransform(tag: string): Transform {
  return new Transform({
    writableObjectMode: true,
    transform(event: TestEvent, _enc, cb) { cb(null, `${tag}:${event.type}\n`); },
  });
}

test('resolveReporter returns a stream instance as-is', async () => {
  const t = tagTransform('X');
  assert.strictEqual(await resolveReporter(t), t);
});

test('runRoutes drives a Transform-instance reporter into its sink', async () => {
  const s = memorySink();
  const config: MuxConfig = { local: [{ reporter: tagTransform('T'), sink: s }] };
  await runRoutes(source(), config, { REPORTERS_OPEN: '0' });
  assert.strictEqual(s.data, 'T:test:pass\nT:test:pass\n');
});

test('a stream reporter error propagates instead of hanging', async () => {
  const s = memorySink();
  const bad = new Transform({
    writableObjectMode: true,
    transform(_event, _enc, cb) { cb(new Error('reporter boom')); },
  });
  const config: MuxConfig = { local: [{ reporter: bad, sink: s }] };
  await assert.rejects(
    () => runRoutes(source(), config, { REPORTERS_OPEN: '0' }),
    /reporter boom/,
  );
});

test('resolveReporter imports a module specifier and rejects a non-reporter', async () => {
  const ok = pathToFileURL(join(here, 'fixtures', 'reporter-module.mjs')).href;
  const fn = await resolveReporter(ok);
  assert.strictEqual(typeof fn, 'function');
  const bad = pathToFileURL(join(here, 'fixtures', 'not-a-reporter.mjs')).href;
  await assert.rejects(() => resolveReporter(bad), /must default-export/);
});

test('mux (default export) loads config from cwd and drives its routes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mux-default-'));
  const reporter = pathToFileURL(join(here, 'fixtures', 'reporter-module.mjs')).href;
  const out = join(dir, 'out.ndjson');
  writeFileSync(join(dir, 'mux.config.mjs'), [
    `import reporter from ${JSON.stringify(reporter)};`,
    `export default { local: [{ reporter, sink: ${JSON.stringify(out)} }] };`,
    '',
  ].join('\n'));

  const prevCwd = process.cwd();
  const prevProfile = process.env.REPORTERS_PROFILE;
  process.chdir(dir);
  process.env.REPORTERS_PROFILE = 'local';
  try {
    // mux yields nothing to Node — drain it so the routes run to completion.
    // eslint-disable-next-line no-restricted-syntax, no-unused-vars
    for await (const _chunk of mux(source())) { /* drain */ }
  } finally {
    process.chdir(prevCwd);
    if (prevProfile === undefined) delete process.env.REPORTERS_PROFILE;
    else process.env.REPORTERS_PROFILE = prevProfile;
  }
  const written = readFileSync(out, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  assert.match(written, /test:pass/);
});
