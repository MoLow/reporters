'use strict';

const { test } = require('node:test');
const { spawnSync } = require('child_process');
const assert = require('assert');
const { compareLines } = require('../../../tests/utils');
const reporter = require('../index');
const output = require('./output');
const outputESM = require('./output-esm');

test('spwan with reporter', () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  assert.strictEqual(child.stderr?.toString(), '');
  compareLines(child.stdout?.toString(), output.stdout);
});

test('spwan with reporter -esm', () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  assert.strictEqual(child.stderr?.toString(), '');
  compareLines(child.stdout?.toString(), outputESM.stdout);
});

test('empty', async () => {
  const lines = [];
  for await (const line of reporter([])) {
    lines.push(line);
  }
  assert.deepStrictEqual(lines, [
    '<?xml version="1.0" encoding="utf-8"?>\n',
    '<testsuites>\n',
    '</testsuites>\n',
  ]);
});

test('single test', async () => {
  const lines = [];
  for await (const line of reporter([{ type: 'test:pass', data: { name: 'test', nesting: 0, details: { duration_ms: 100 } } }])) {
    lines.push(line);
  }
  assert.deepStrictEqual(lines, [
    '<?xml version="1.0" encoding="utf-8"?>\n',
    '<testsuites>\n',
    '\t<undefined name="root">\n\t<testcase name="test" time="0.100000" classname="test"/>\n\t</undefined>\n',
    '</testsuites>\n',
  ]);
});
