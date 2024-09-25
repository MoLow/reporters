'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const { Snap } = require('../../../tests/utils');

const snapshot = Snap(__filename);

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  await snapshot(child);
});

test('spawn with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  await snapshot(child);
});
