'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const { Snap } = require('../../../tests/utils');

const snapshot = Snap(__filename);

test('spwan with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  await snapshot(child);
});

test('spwan with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  await snapshot(child);
});
