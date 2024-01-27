'use strict';

const { test, describe, beforeEach } = require('node:test');
const { spawnSync } = require('child_process');
const { tmpdir } = require('os');
const { join } = require('path');
const assert = require('assert');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { compareLines } = require('../../../tests/utils');
const output = require('./output');
const outputESM = require('./output-esm');

const GITHUB_STEP_SUMMARY = join(tmpdir(), 'github-actions-test-reporter');
const nodeMajor = process.versions.node.split('.')[0];

describe('github reporter', () => {
  beforeEach(() => {
    writeFileSync(GITHUB_STEP_SUMMARY, '');
  });

  test('spawn with reporter', () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../') },
    });

    assert.strictEqual(child.stderr?.toString(), '');
    compareLines(child.stdout?.toString(), output.overrides[nodeMajor]?.stdout ?? output.stdout);
    compareLines(readFileSync(GITHUB_STEP_SUMMARY).toString(), output.summary);
  });

  test('spawn with reporter - esm', () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../') },
    });

    assert.strictEqual(child.stderr?.toString(), '');
    compareLines(
      child.stdout?.toString(),
      outputESM.overrides[nodeMajor]?.stdout ?? outputESM.stdout,
    );
    compareLines(readFileSync(GITHUB_STEP_SUMMARY).toString(), outputESM.summary);
  });

  test('should noop if not in github actions', () => {
    const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { } });
    assert.strictEqual(silentChild.stderr?.toString(), '');
    assert.strictEqual(silentChild.stdout?.toString(), '');
  });
});
