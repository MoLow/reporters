const { spawnSync } = require('child_process');
const assert = require('assert');
const { compareLines } = require('../../../tests/utils');
// eslint-disable-next-line import/no-dynamic-require
const output = require(`./output.${process.version.split('.')[0]}`);

const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example']);

assert.strictEqual(child.stderr?.toString(), '');
compareLines(child.stdout?.toString(), output.stdout);
