import { test } from 'node:test';
import assert from 'node:assert';
import web, {
  soleFileDestination, isCI, shouldOpen, openCommand, internals,
} from '../src/index.ts';
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

async function collectStderrWithExecArgv(mode: string, extra: string[]): Promise<string> {
  const original = process.execArgv;
  const originalOpen = process.env.REPORTERS_WEB_OPEN;
  process.execArgv = [...original, ...extra];
  process.env.REPORTERS_WEB_OPEN = '0'; // don't launch a browser during tests
  try {
    return await collectStderr(mode);
  } finally {
    process.execArgv = original;
    if (originalOpen === undefined) delete process.env.REPORTERS_WEB_OPEN;
    else process.env.REPORTERS_WEB_OPEN = originalOpen;
  }
}

test('embedded hint includes the destination file path', async () => {
  const err = await collectStderrWithExecArgv('embedded', ['--test-reporter-destination=report.html']);
  assert.match(err, /report at file:\/\/.*report\.html/);
});

test('ndjson hint includes the destination and the viewer URL', async () => {
  const err = await collectStderrWithExecArgv('ndjson', ['--test-reporter-destination=run.ndjson']);
  assert.match(err, /run\.ndjson/);
  assert.match(err, /molow\.github\.io\/reporters\/\?src=/);
});

test('soleFileDestination reads --test-reporter-destination from execArgv', () => {
  assert.strictEqual(soleFileDestination(['--test-reporter-destination=report.html']), 'report.html');
  assert.strictEqual(soleFileDestination(['--test-reporter-destination', 'out.html']), 'out.html');
  // stream destinations are ignored; a lone real file still wins
  assert.strictEqual(soleFileDestination(['--test-reporter-destination', 'stdout', '--test-reporter-destination=r.html']), 'r.html');
  // ambiguous (two files) or none => undefined
  assert.strictEqual(soleFileDestination(['--test-reporter-destination=a', '--test-reporter-destination=b']), undefined);
  assert.strictEqual(soleFileDestination(['--test']), undefined);
});

test('isCI detects common CI environments', () => {
  assert.strictEqual(isCI({}), false);
  assert.strictEqual(isCI({ CI: 'true' }), true);
  assert.strictEqual(isCI({ GITHUB_ACTIONS: 'true' }), true);
});

test('shouldOpen: on locally, off in CI, forceable via env', () => {
  assert.strictEqual(shouldOpen({}), true);
  assert.strictEqual(shouldOpen({ CI: 'true' }), false);
  assert.strictEqual(shouldOpen({ CI: 'true', REPORTERS_WEB_OPEN: '1' }), true);
  assert.strictEqual(shouldOpen({ REPORTERS_WEB_OPEN: '0' }), false);
  assert.strictEqual(shouldOpen({ REPORTERS_WEB_OPEN: 'false' }), false);
});

test('openCommand is platform-specific', () => {
  assert.deepStrictEqual(openCommand('u', 'darwin'), ['open', ['u']]);
  assert.deepStrictEqual(openCommand('u', 'linux'), ['xdg-open', ['u']]);
  assert.deepStrictEqual(openCommand('u', 'win32'), ['cmd', ['/c', 'start', '', 'u']]);
});

async function runEmbedded(open: string): Promise<string | undefined> {
  const origArgv = process.execArgv;
  const origOpen = process.env.REPORTERS_WEB_OPEN;
  const origMode = process.env.REPORTERS_WEB_MODE;
  const origFn = internals.openInBrowser;
  let opened: string | undefined;
  internals.openInBrowser = (u) => { opened = u; };
  process.execArgv = [...origArgv, '--test-reporter-destination=report.html'];
  process.env.REPORTERS_WEB_OPEN = open;
  process.env.REPORTERS_WEB_MODE = 'embedded';
  try {
    // eslint-disable-next-line no-restricted-syntax, no-unused-vars
    for await (const _chunk of web(events)) { /* drain */ }
  } finally {
    process.execArgv = origArgv;
    internals.openInBrowser = origFn;
    if (origOpen === undefined) delete process.env.REPORTERS_WEB_OPEN; else process.env.REPORTERS_WEB_OPEN = origOpen;
    if (origMode === undefined) delete process.env.REPORTERS_WEB_MODE; else process.env.REPORTERS_WEB_MODE = origMode;
  }
  return opened;
}

test('embedded opens the report locally, and not when disabled', async () => {
  assert.match((await runEmbedded('1'))!, /file:\/\/.*report\.html/);
  assert.strictEqual(await runEmbedded('0'), undefined);
});
