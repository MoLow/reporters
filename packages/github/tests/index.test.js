const { spawnSync } = require('child_process');
const { tmpdir } = require('os');
const { join } = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { compareLines } = require('../../../tests/utils');
const output = require('./output');

const GITHUB_STEP_SUMMARY = join(tmpdir(), 'github-actions-test-reporter');
writeFileSync(GITHUB_STEP_SUMMARY, '');

const child = spawnSync('node', ['--test-reporter', './index.js', '../../tests/example'], {
  env: { GITHUB_STEP_SUMMARY },
});
const stdout = child.stdout?.toString();
const summary = readFileSync(GITHUB_STEP_SUMMARY).toString();

compareLines(stdout, output.stdout);
compareLines(summary, output.summary);
