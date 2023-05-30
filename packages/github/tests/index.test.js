const { spawnSync } = require('child_process');
const { tmpdir } = require('os');
const { join } = require('path');
const assert = require('assert');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { compareLines } = require('../../../tests/utils');
// eslint-disable-next-line import/no-dynamic-require
const output = require(`./output.${process.version.split('.')[0]}`);

const GITHUB_STEP_SUMMARY = join(tmpdir(), 'github-actions-test-reporter');
writeFileSync(GITHUB_STEP_SUMMARY, '');

const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
  env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../') },
});

assert.strictEqual(child.stderr?.toString(), '');
compareLines(child.stdout?.toString(), output.stdout);
compareLines(readFileSync(GITHUB_STEP_SUMMARY).toString(), output.summary);

const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { } });
assert.strictEqual(silentChild.stderr?.toString(), '');
assert.strictEqual(silentChild.stdout?.toString(), '');
