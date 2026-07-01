import { test } from 'node:test';
import assert from 'node:assert';
import web from '../src/index.ts';
import { htmlHeader, HTML_FOOTER, safeEventLine } from '../src/template.ts';
import type { TestEvent } from '@reporters/tree-core';

const events: TestEvent[] = [
  { type: 'test:start', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
  { type: 'test:pass', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 1, error: new Error('x') } } },
];

async function collect(mode: string): Promise<string[]> {
  const prev = process.env.REPORTERS_WEB_MODE;
  process.env.REPORTERS_WEB_MODE = mode;
  try {
    const out: string[] = [];
    for await (const chunk of web(events)) out.push(chunk);
    return out;
  } finally {
    if (prev === undefined) delete process.env.REPORTERS_WEB_MODE;
    else process.env.REPORTERS_WEB_MODE = prev;
  }
}

test('ndjson mode yields one JSON-safe wire line per event', async () => {
  const out = await collect('ndjson');
  assert.strictEqual(out.length, 2);
  const parsed = out.map((line) => JSON.parse(line));
  assert.strictEqual(parsed[0].type, 'test:start');
  assert.strictEqual(parsed[1].type, 'test:pass');
  // Error was flattened to a serializable shape.
  assert.strictEqual(parsed[1].data.details.error.message, 'x');
});

test('embedded mode yields a valid HTML shell wrapping the NDJSON log', async () => {
  const out = await collect('embedded');
  const html = out.join('');
  assert.match(out[0], /^<!doctype html>/);
  assert.match(out[0], /<script type="application\/x-ndjson" id="events">/);
  assert.match(html, /__reportersRenderEmbedded/);
  assert.match(out[out.length - 1], /<\/html>/);
  // the event log sits between header and footer
  assert.ok(html.indexOf('test:start') > html.indexOf('id="events"'));
  assert.ok(html.indexOf('test:start') < html.indexOf('</html>'));
});

test('htmlHeader inlines the client bundle and a DOMContentLoaded fallback', () => {
  const header = htmlHeader('CLIENT_BUNDLE_MARKER');
  assert.match(header, /CLIENT_BUNDLE_MARKER/);
  assert.match(header, /DOMContentLoaded/);
  assert.match(HTML_FOOTER, /__reportersRenderEmbedded/);
});

test('safeEventLine neutralizes a literal closing script tag', () => {
  const escaped = safeEventLine('{"m":"</script>"}');
  assert.doesNotMatch(escaped, /<\/script>/);
});

async function collectStderr(mode: string): Promise<string> {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  // @ts-expect-error test spy
  process.stderr.write = (chunk: string) => { captured += chunk; return true; };
  try {
    await collect(mode);
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

test('ndjson mode logs a viewer hint to stderr', async () => {
  assert.match(await collectStderr('ndjson'), /molow\.github\.io\/reporters\/\?src=/);
});

test('embedded mode logs a hint to stderr', async () => {
  assert.match(await collectStderr('embedded'), /report/i);
});
