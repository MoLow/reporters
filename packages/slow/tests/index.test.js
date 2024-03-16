'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const { Snap } = require('../../../tests/utils');

const snapshot = Snap(__filename);

test('spwan with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/slow_tests.js'], { env: { FORCE_COLOR: 1 } });
  await snapshot(child);
});
