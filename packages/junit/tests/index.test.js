const { spawnSync } = require('child_process');
const { compareLines } = require('../../../tests/utils');
const output = require('./output');

const child = spawnSync('../../../node/node', ['--test-reporter', './index.js', '../../tests/example']);
const stdout = child.stdout?.toString();
compareLines(stdout, output.stdout);
