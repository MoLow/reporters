import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { Snap } from '../../../tests/utils.js';

const snapshot = Snap(import.meta.filename);

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/slow_tests.js'], { env: { FORCE_COLOR: 1 } });
  await snapshot(child);
});
