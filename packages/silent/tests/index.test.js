'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const assert = require('assert');

test('spwan with reporter', () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  assert.strictEqual(child.stderr?.toString(), '');
  assert.strictEqual(child.stdout?.toString(), '');
});

test('spwan with reporter - esm', () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  assert.strictEqual(child.stderr?.toString(), '');
  assert.strictEqual(child.stdout?.toString(), '');
});
