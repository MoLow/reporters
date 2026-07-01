import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const reporter = join(here, '..', 'dist', 'index.js');
const example = join(here, '..', '..', '..', 'tests', 'example.js');

function runToFile(mode: string, out: string) {
  // REPORTERS_WEB_OPEN=0 so the spawned reporter doesn't launch a browser.
  const env = { ...process.env, REPORTERS_WEB_MODE: mode, REPORTERS_WEB_OPEN: '0' };
  delete env.NODE_TEST_CONTEXT;
  spawnSync(
    process.execPath,
    ['--test', '--test-reporter', reporter, '--test-reporter-destination', out, example],
    { encoding: 'utf8', env },
  );
  const html = readFileSync(out, 'utf8');
  rmSync(out, { force: true });
  return html;
}

test('embedded mode writes a self-contained HTML file with bundle + event log', () => {
  const out = join(here, 'tmp-report.html');
  const html = runToFile('embedded', out);
  assert.match(html, /^<!doctype html>/);
  // the React client bundle is inlined (no external scripts)
  assert.match(html, /__reportersRenderEmbedded/);
  assert.match(html, /react/i);
  // the NDJSON event log is embedded and contains real events
  assert.match(html, /"type":"test:pass"/);
  assert.match(html, /<\/html>/);
  // no external resource references
  assert.doesNotMatch(html, /<script[^>]+src=/);
});

test('ndjson mode writes a raw event log (no HTML)', () => {
  const out = join(here, 'tmp-run.ndjson');
  const ndjson = runToFile('ndjson', out);
  assert.doesNotMatch(ndjson, /<!doctype/);
  const lines = ndjson.trim().split('\n').filter(Boolean);
  assert.ok(lines.length > 0);
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
});
