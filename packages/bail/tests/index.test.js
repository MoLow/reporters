'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const { Snap } = require('../../../tests/utils');

const snapshot = Snap(__filename);
test('pass should not interfere with passing test', async () => {
  const child = spawnSync(process.execPath, [
    '--test-reporter', 'dot', '--test-reporter-destination', 'stdout',
    '--test-reporter', './index.js', '--test-reporter-destination', 'stdout', 'tests/fixtures/pass.js',
  ], { env: {} });

  await snapshot(child);
});

test('fail should stop after failed test', async () => {
  const child = spawnSync(process.execPath, [
    '--test-reporter', 'dot', '--test-reporter-destination', 'stdout',
    '--test-reporter', './index.js', '--test-reporter-destination', 'stdout',
    'tests/fixtures/fail.js', 'tests/fixtures/pass.js',
  ], { env: {} });
  await snapshot(child);
});
