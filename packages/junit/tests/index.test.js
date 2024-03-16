'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const assert = require('assert');
const reporter = require('../index');
const { Snap, nodeMajor } = require('../../../tests/utils');

const snapshot = Snap(`${__filename}.${nodeMajor}`);

test('spwan with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  await snapshot(child);
});

test('spwan with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  await snapshot(child);
});

test('empty', async () => {
  const lines = [];
  for await (const line of reporter([])) {
    lines.push(line);
  }

  assert.deepStrictEqual(lines, await snapshot.snap(lines));
});

test('single test', async () => {
  const lines = [];
  for await (const line of reporter([{ type: 'test:pass', data: { name: 'test', nesting: 0, details: { duration_ms: 100 } } }])) {
    lines.push(line);
  }
  assert.deepStrictEqual(lines, await snapshot.snap(lines));
});
