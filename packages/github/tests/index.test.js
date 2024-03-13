'use strict';

const { test, describe, beforeEach } = require('node:test');
const { spawnSync } = require('child_process');
const { tmpdir } = require('os');
const { join } = require('path');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { Snap, nodeMajor } = require('../../../tests/utils');

const snapshot = Snap(`${__filename}.${nodeMajor}`);
const GITHUB_STEP_SUMMARY = join(tmpdir(), 'github-actions-test-reporter');

describe('github reporter', () => {
  beforeEach(() => {
    writeFileSync(GITHUB_STEP_SUMMARY, '');
  });

  test('spawn with reporter', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../') },
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('spawn with reporter - esm', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../') },
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('should noop if not in github actions', async () => {
    const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { } });
    await snapshot(silentChild);
  });
});
