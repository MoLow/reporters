import { test, describe, beforeEach } from 'node:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { Snap, nodeMajor } from '../../../tests/utils.js';

const snapshot = Snap(`${import.meta.filename}.${nodeMajor}`);
// Unique per test-file process: gh's and github's tests run concurrently
// under the root runner and must not truncate each other's summary file.
const GITHUB_STEP_SUMMARY = join(tmpdir(), `github-actions-test-reporter-${process.pid}`);
const pkgDir = join(import.meta.dirname, '..');

describe('github spec reporter', () => {
  beforeEach(() => {
    writeFileSync(GITHUB_STEP_SUMMARY, '');
  });

  test('spawn with reporter', async (t) => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
      cwd: pkgDir,
    });

    t.diagnostic('This is a diagnostic message');
    t.diagnostic('This is another diagnostic message');
    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('spawn with reporter - esm', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
      cwd: pkgDir,
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('should noop if not in github actions', async () => {
    const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { }, cwd: pkgDir });
    await snapshot(silentChild);
  });

  test('spawn with reporter - all passing', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example-pass.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
      cwd: pkgDir,
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });
});
