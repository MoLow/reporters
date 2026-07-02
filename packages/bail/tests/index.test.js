import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Snap } from '../../../tests/utils.js';

const snapshot = Snap(import.meta.filename);
const pkgDir = join(import.meta.dirname, '..');
test('pass should not interfere with passing test', async () => {
  const child = spawnSync(process.execPath, [
    '--test-reporter', 'dot', '--test-reporter-destination', 'stdout',
    '--test-reporter', './index.js', '--test-reporter-destination', 'stdout', 'tests/fixtures/pass.js',
  ], { env: {}, cwd: pkgDir });

  await snapshot(child);
});

test('fail should stop after failed test', async () => {
  const child = spawnSync(process.execPath, [
    '--test-reporter', 'dot', '--test-reporter-destination', 'stdout',
    '--test-reporter', './index.js', '--test-reporter-destination', 'stdout',
    'tests/fixtures/fail.js', 'tests/fixtures/pass.js',
  ], { env: {}, cwd: pkgDir });
  await snapshot(child);
});
