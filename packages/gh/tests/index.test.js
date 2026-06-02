import { test, describe, beforeEach } from 'node:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { Snap, nodeMajor } from '../../../tests/utils.js';

const snapshot = Snap(`${import.meta.filename}.${nodeMajor}`);
const GITHUB_STEP_SUMMARY = join(tmpdir(), 'github-actions-test-reporter');

describe('github spec reporter', () => {
  beforeEach(() => {
    writeFileSync(GITHUB_STEP_SUMMARY, '');
  });

  test('spawn with reporter', async (t) => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
    });

    t.diagnostic('This is a diagnostic message');
    t.diagnostic('This is another diagnostic message');
    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('spawn with reporter - esm', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });

  test('should noop if not in github actions', async () => {
    const silentChild = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: { } });
    await snapshot(silentChild);
  });

  test('spawn with reporter - all passing', async () => {
    const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example-pass.mjs'], {
      env: { GITHUB_ACTIONS: true, GITHUB_STEP_SUMMARY, GITHUB_WORKSPACE: path.resolve(import.meta.dirname, '../../../') },
    });

    await snapshot(child, readFileSync(GITHUB_STEP_SUMMARY).toString('utf-8'));
  });
});
