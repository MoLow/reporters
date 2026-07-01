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
  for await (const chunk of web(events)) out.push(chunk);
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

test('web with open:true serves a live view, opens the browser, and still emits NDJSON', async () => {
  const origOpen = internals.openInBrowser;
  let opened: string | undefined;
  internals.openInBrowser = (u) => { opened = u; };
  try {
    const out: string[] = [];
    // stdin isn't a TTY under `node --test`, so the server shuts down at the end.
    for await (const chunk of web(events, { open: true })) out.push(chunk);
    assert.strictEqual(out.length, 2); // NDJSON still yielded to the destination
    assert.match(opened!, /^http:\/\/127\.0\.0\.1:\d+\/\?src=\/run\.ndjson$/);
  } finally {
    internals.openInBrowser = origOpen;
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
