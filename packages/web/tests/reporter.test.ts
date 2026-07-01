import { test } from 'node:test';
import assert from 'node:assert';
import web from '../src/index.ts';
import { internals } from '../src/open.ts';
import type { TestEvent } from '@reporters/tree-core';

const events: TestEvent[] = [
  { type: 'test:start', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
  { type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 1, error: new Error('x') } } },
];

async function collect(): Promise<string[]> {
  const out: string[] = [];
  // open:false keeps it a pure emitter regardless of the ambient TTY.
  for await (const chunk of web(events, { open: false })) out.push(chunk);
  return out;
}

test('web yields one JSON-safe NDJSON wire line per event', async () => {
  const out = await collect();
  assert.strictEqual(out.length, 2);
  const parsed = out.map((line) => JSON.parse(line));
  assert.strictEqual(parsed[0].type, 'test:start');
  assert.strictEqual(parsed[1].type, 'test:pass');
  // Error was flattened to a serializable shape.
  assert.strictEqual(parsed[1].data.details.error.message, 'x');
});

test('web emits no HTML and every line ends with a newline', async () => {
  const out = await collect();
  for (const line of out) {
    assert.doesNotMatch(line, /<!doctype|<script/i);
    assert.match(line, /\n$/);
  }
});

test('web with open:true and no file destination serves + opens, and keeps stdout quiet', async () => {
  const origOpen = internals.openInBrowser;
  let opened: string | undefined;
  internals.openInBrowser = (u) => { opened = u; };
  try {
    const out: string[] = [];
    // stdin isn't a TTY under `node --test`, so the server shuts down at the end.
    for await (const chunk of web(events, { open: true })) out.push(chunk);
    // No file destination → the browser is the only view; nothing is written to stdout.
    assert.strictEqual(out.length, 0);
    assert.match(opened!, /^http:\/\/127\.0\.0\.1:\d+\/\?src=\/run\.ndjson$/);
  } finally {
    internals.openInBrowser = origOpen;
  }
});

test('web with open:true and a file destination serves + opens AND writes NDJSON to the file', async () => {
  const origOpen = internals.openInBrowser;
  const origArgv = process.execArgv;
  let opened: string | undefined;
  internals.openInBrowser = (u) => { opened = u; };
  process.execArgv = [...origArgv, '--test-reporter-destination=run.ndjson'];
  try {
    const out: string[] = [];
    for await (const chunk of web(events, { open: true })) out.push(chunk);
    // A file destination exists → NDJSON is still emitted (to the file) while serving.
    assert.strictEqual(out.length, 2);
    assert.match(opened!, /\/\?src=\/run\.ndjson$/);
  } finally {
    internals.openInBrowser = origOpen;
    process.execArgv = origArgv;
  }
});

test('web with open:false stays a pure emitter and opens nothing', async () => {
  const origOpen = internals.openInBrowser;
  let opened = false;
  internals.openInBrowser = () => { opened = true; };
  try {
    const out: string[] = [];
    for await (const chunk of web(events, { open: false })) out.push(chunk);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(opened, false);
  } finally {
    internals.openInBrowser = origOpen;
  }
});
