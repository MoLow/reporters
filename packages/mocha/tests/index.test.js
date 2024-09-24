'use strict';

const { test } = require('node:test');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('assert');
const { Snap, nodeMajor } = require('../../../tests/utils');
const reporter = require('../index');

const snapshot = Snap(`${__filename}.${nodeMajor}`);

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  await snapshot(child);
});

test('spawn with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  await snapshot(child);
});

test('custom reporter - file', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/example.js'], { env: {}, cwd: resolve('./tests/customReporter') });
  await snapshot(child);
});

test('custom reporter - function', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/example.js'], { env: {}, cwd: resolve('./tests/importReporter') });
  await snapshot(child);
});

test('reporter not found', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/example.js'], { env: {}, cwd: resolve('./tests/invalidReporter') });
  await snapshot(child);
});

test('empty', async () => {
  await assert.doesNotReject(reporter([]));
});

test('single test', async () => {
  await assert.doesNotReject(reporter([{ type: 'test:pass', data: { name: 'test', nesting: 0, details: { duration_ms: 100 } } }]));
});
