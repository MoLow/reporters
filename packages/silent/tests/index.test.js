import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { Snap } from '../../../tests/utils.js';

const snapshot = Snap(import.meta.filename);

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  await snapshot(child);
});

test('spawn with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  await snapshot(child);
});
