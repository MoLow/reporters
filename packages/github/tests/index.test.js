import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { Snap, nodeMajor } from '../../../tests/utils.js';
import { transformEvent } from '../index.js';

const snapshot = Snap(`${import.meta.filename}.${nodeMajor}`);
// Unique per test-file process: gh's and github's tests run concurrently
// under the root runner and must not truncate each other's summary file.
const GITHUB_STEP_SUMMARY = join(tmpdir(), `github-actions-test-reporter-${process.pid}`);
const pkgDir = join(import.meta.dirname, '..');

describe('github reporter', () => {
  beforeEach(() => {
    writeFileSync(GITHUB_STEP_SUMMARY, '');
  });

  test('spawn with reporter', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
      cwd: pkgDir,
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('spawn with reporter - esm', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
      cwd: pkgDir,
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('GITHUB_ACTIONS_REPORTER_VERBOSE', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: {
        GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../'), GITHUB_ACTIONS_REPORTER_VERBOSE: true,
      },
      cwd: pkgDir,
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('should noop if not in github actions', async () => {
    const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { }, cwd: pkgDir });
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
