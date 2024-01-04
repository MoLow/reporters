'use strict';

const assert = require('assert');
const { test } = require('node:test');
const { spawnSync } = require('child_process');
const { compareLines } = require('../../../tests/utils');

test('spwan with reporter', () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/slow_tests.js'], { env: { FORCE_COLOR: 1 } });
  assert.strictEqual(child.stderr?.toString(), '');
  compareLines(child.stdout?.toString(), `\
file: .*tests/slow_tests\\.js has slow tests:
  \\\x1B\\[31m-\\\x1B\\[0m is too slow \\[\x1B\\[31m1s\\\x1B\\[0m\\] \\(\\\x1B\\[0m.*tests/slow_tests\\.js:9:3\\)
  \\\x1B\\[38;5;215m-\\\x1B\\[0m is pretty slow \\[\\\x1B\\[38;5;215m.*ms\\\x1B\\[0m\\] \\(\\\x1B\\[0m.*tests/slow_tests\\.js:8:3\\)
  \\\x1B\\[33m-\\\x1B\\[0m is a little slow \\[\x1B\\[33m.*ms\\\x1B\\[0m\\] \\(\\\x1B\\[0m.*tests/slow_tests\\.js:7:3\\)
`);
});
