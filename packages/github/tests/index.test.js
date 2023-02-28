const { spawnSync } = require('child_process');
const { tmpdir } = require('os');
const { join } = require('path');
const assert = require('assert');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { compareLines } = require('../../../tests/utils');
const output = require('./output');

const GITHUB_STEP_SUMMARY = join(tmpdir(), 'github-actions-test-reporter');
writeFileSync(GITHUB_STEP_SUMMARY, '');

const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
  env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../') },
});

assert.strictEqual(child.stderr?.toString(), '');
compareLines(child.stdout?.toString(), output.stdout);
compareLines(readFileSync(GITHUB_STEP_SUMMARY).toString(), output.summary);
