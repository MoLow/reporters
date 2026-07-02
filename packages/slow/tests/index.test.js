import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Snap } from '../../../tests/utils.js';

const snapshot = Snap(import.meta.filename);
const pkgDir = join(import.meta.dirname, '..');

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/slow_tests.js'], { env: { FORCE_COLOR: 1 }, cwd: pkgDir });
  await snapshot(child);
});
