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

describe('test:log annotations', () => {
  const log = (data) => transformEvent({
    type: 'test:log',
    data: {
      name: 't', nesting: 0, file: 'x.js', line: 3, column: 1, testId: 1, ...data,
    },
  });

  const passed = (data) => transformEvent({
    type: 'test:pass',
    data: {
      name: 't', nesting: 0, file: 'x.js', line: 3, column: 1, testId: 1, details: { duration_ms: 1 }, ...data,
    },
  });

  const verbose = (fn) => {
    process.env.GITHUB_ACTIONS_REPORTER_VERBOSE = '1';
    try {
      return fn();
    } finally {
      delete process.env.GITHUB_ACTIONS_REPORTER_VERBOSE;
    }
  };

  test('a log becomes a notice only when verbose is enabled', () => {
    delete process.env.GITHUB_ACTIONS_REPORTER_VERBOSE;
    assert.strictEqual(log({ message: 'quiet' }), '');
    assert.doesNotMatch(passed({}), /quiet/);

    verbose(() => {
      assert.strictEqual(log({ message: 'fetched user' }), '', 'held until the test reports');
      const out = passed({});
      assert.match(out, /::notice /);
      assert.match(out, /fetched user/);
    });
  });

  test('a notice carries the log payload', () => {
    verbose(() => {
      log({ message: 'fetched', data: { userId: 42 } });
      assert.match(passed({}), /fetched \{"userId":42\}/);
    });
  });

  test('a log waits for its own test, not the next one to report', () => {
    verbose(() => {
      log({ name: 'owner', testId: 7, message: 'owned line' });
      assert.doesNotMatch(passed({ name: 'bystander', testId: 8 }), /owned line/);
      assert.match(passed({ name: 'owner', testId: 7 }), /owned line/);
    });
  });

  test('a failing test flushes its logs even when its error is suppressed', () => {
    // A parent whose only error is `subtestsFailed` emits no annotation of its
    // own; its logs must not be swallowed with it.
    verbose(() => {
      log({ name: 'parent', testId: 9, message: 'parent line' });
      const out = transformEvent({
        type: 'test:fail',
        data: {
          name: 'parent',
          nesting: 0,
          file: 'x.js',
          line: 3,
          column: 1,
          testId: 9,
          details: { error: { code: 'ERR_TEST_FAILURE', failureType: 'subtestsFailed' } },
        },
      });
      assert.match(out, /parent line/);
    });
  });

  test('a log with no location does not throw', () => {
    // Node stamps a log with the owning test's `loc`, which is undefined for the
    // root test; a location-less notice is still better than a crash.
    verbose(() => {
      const nowhere = { file: undefined, line: undefined, column: undefined };
      let out;
      assert.doesNotThrow(() => {
        log({ ...nowhere, testId: 11, message: 'no location' });
        out = passed({ ...nowhere, testId: 11 });
      });
      assert.match(out, /::notice::no location/);
    });
  });
});
