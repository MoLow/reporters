import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const reporter = join(here, '..', 'dist', 'index.js');
const example = join(here, '..', '..', '..', 'tests', 'example.js');

function run(extraEnv: Record<string, string> = {}) {
  const env = { ...process.env, REPORTERS_LIVE_PLAIN: '1', ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(
    process.execPath,
    ['--test', '--test-reporter', reporter, '--test-reporter-destination', 'stdout', example],
    { encoding: 'utf8', env },
  );
}

test('the built reporter renders a tree and reflects failures in the exit code', () => {
  const child = run();
  const out = child.stdout ?? '';
  assert.match(out, /example\.js/);
  assert.match(out, /✔ is ok/);
  assert.match(out, /✖/);
  assert.match(out, /passed/);
  assert.match(out, /failed/);
  assert.notStrictEqual(child.status, 0, 'a run with failing tests should exit non-zero');
});

test('without a TTY it prints a fully expanded tree and exits rather than blocking', () => {
  const child = run({ REPORTERS_LIVE_PLAIN: '' });
  const out = child.stdout ?? '';
  assert.match(out, /example\.js/);
  assert.match(out, /✔ is ok/);
  assert.match(out, /passed/);
  assert.notStrictEqual(child.status, null, 'the process must terminate on its own');
  assert.notStrictEqual(child.status, 0, 'a run with failing tests should exit non-zero');
});
