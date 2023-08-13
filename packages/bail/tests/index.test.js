'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const assert = require('assert');

test('pass should not interfere with passing test', () => {
  const child = spawnSync(process.execPath, [
    '--test-reporter', 'dot', '--test-reporter-destination', 'stdout',
    '--test-reporter', './index.js', '--test-reporter-destination', 'stdout', 'tests/fixtures/pass.js',
  ], { env: {} });
  assert.strictEqual(child.stderr?.toString(), '');
  assert.strictEqual(child.stdout?.toString(), '.\n');
  assert.strictEqual(child.status, 0);
});

test('fail should stop after failed test', () => {
  const child = spawnSync(process.execPath, [
    '--test-reporter', 'dot', '--test-reporter-destination', 'stdout',
    '--test-reporter', './index.js', '--test-reporter-destination', 'stdout',
    'tests/fixtures/fail.js', 'tests/fixtures/pass.js',
  ], { env: {} });
  assert.strictEqual(child.stderr?.toString(), '');
  assert.strictEqual(child.stdout?.toString(), 'X\n\x1B[31m✖ Bailing on failed test: fail\x1B[0m\n');
  assert.strictEqual(child.status, 1);
});
