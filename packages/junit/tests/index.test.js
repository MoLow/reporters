const { spawnSync } = require('child_process');
const assert = require('assert');
const { compareLines } = require('../../../tests/utils');
const output = require('./output');

const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example']);

assert.strictEqual(child.stderr?.toString(), '');
compareLines(child.stdout?.toString(), output.stdout);
