import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const reporter = join(here, '..', 'dist', 'index.js');
const example = join(here, '..', '..', '..', 'tests', 'example.js');

test('web writes a raw NDJSON event log (no HTML)', () => {
  const out = join(here, 'tmp-run.ndjson');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  spawnSync(
    process.execPath,
    ['--test', '--test-reporter', reporter, '--test-reporter-destination', out, example],
    { encoding: 'utf8', env },
  );
  const ndjson = readFileSync(out, 'utf8');
  rmSync(out, { force: true });
  assert.doesNotMatch(ndjson, /<!doctype/i);
  const lines = ndjson.trim().split('\n').filter(Boolean);
  assert.ok(lines.length > 0);
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
});
