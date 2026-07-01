import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const muxReporter = join(here, '..', 'dist', 'index.js');
const linesReporter = join(here, 'fixtures', 'lines-reporter.mjs');
const example = join(here, '..', '..', '..', 'tests', 'example.js');

test('mux tees a real run to two file sinks under the local profile', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mux-e2e-'));
  // Config lives in the temp cwd; both routes use the same fixture reporter,
  // each writing to its own file sink (relative paths resolve against cwd).
  writeFileSync(join(dir, 'mux.config.mjs'), [
    `import lines from ${JSON.stringify(linesReporter)};`,
    'export default {',
    "  local: [",
    "    { reporter: lines, sink: 'a.ndjson' },",
    "    { reporter: lines, sink: 'b.ndjson' },",
    '  ],',
    '};',
    '',
  ].join('\n'));

  const env = { ...process.env, REPORTERS_PROFILE: 'local', REPORTERS_OPEN: '0' };
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(
    process.execPath,
    ['--test', '--test-reporter', muxReporter, '--test-reporter-destination', 'stdout', example],
    { cwd: dir, encoding: 'utf8', env },
  );

  // Note: `node --test` exits non-zero because tests/example.js has intentional
  // failures, so the child's exit code is not a useful signal here — a mux crash
  // is instead caught by the missing/empty sink files below.
  const a = readFileSync(join(dir, 'a.ndjson'), 'utf8');
  const b = readFileSync(join(dir, 'b.ndjson'), 'utf8');
  rmSync(dir, { recursive: true, force: true });

  assert.ok(a.length > 0, `route A produced no output; stderr: ${res.stderr}`);
  assert.ok(b.length > 0, `route B produced no output; stderr: ${res.stderr}`);
  assert.strictEqual(a, b, 'both routes should see the same teed events');
  assert.match(a, /test:pass|test:fail/);
});
