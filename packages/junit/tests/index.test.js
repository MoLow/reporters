import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert';
import reporter from '../index.js';
import { Snap, nodeMajor } from '../../../tests/utils.js';

const snapshot = Snap(`${import.meta.filename}.${nodeMajor}`);
const pkgDir = join(import.meta.dirname, '..');

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {}, cwd: pkgDir });
  await snapshot(child);
});

test('spawn with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {}, cwd: pkgDir });
  await snapshot(child);
});

test('empty', async () => {
  const lines = [];
  for await (const line of reporter([])) {
    lines.push(line);
  }

  assert.deepStrictEqual(
    snapshot.snap.serialize(lines),
    await snapshot.snap(snapshot.snap.serialize(lines)),
  );
});

test('single test', async () => {
  const lines = [];
  for await (const line of reporter([{ type: 'test:pass', data: { name: 'test', nesting: 0, details: { duration_ms: 100 } } }])) {
    lines.push(line);
  }
  assert.deepStrictEqual(
    snapshot.snap.serialize(lines),
    await snapshot.snap(snapshot.snap.serialize(lines)),
  );
});
