'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const { tmpdir } = require('os');
const { join } = require('path');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const { Snap, nodeMajor } = require('../../../tests/utils');
const { transformEvent } = require('../index');

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

  test('GITHUB_ACTIONS_REPORTER_VERBOSE', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: {
        GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(__dirname, '../../../'), GITHUB_ACTIONS_REPORTER_VERBOSE: true,
      },
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('should noop if not in github actions', async () => {
    const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { } });
    await snapshot(silentChild);
  });

  test('transformEvent tolerates test:fail with no error object', () => {
    // Node can emit test:fail where details.error is null (e.g. hook re-runs
    // that reset this.error — see lib/internal/test_runner/test.js). The
    // reporter must not throw on such events, otherwise the unhandled 'error'
    // on the Transform stream crashes the whole test runner.
    assert.doesNotThrow(() => transformEvent({
      type: 'test:fail',
      data: {
        name: 'no error',
        details: { error: null },
        file: 'x.js',
        line: 1,
        column: 1,
      },
    }));
    assert.doesNotThrow(() => transformEvent({
      type: 'test:fail',
      data: {
        name: 'no details',
        file: 'x.js',
        line: 1,
        column: 1,
      },
    }));
  });
});
