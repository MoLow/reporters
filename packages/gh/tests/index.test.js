import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
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

/* eslint-disable no-underscore-dangle */
describe('test:log rendering', () => {
  // Driven with synthetic events rather than a t.log() fixture: t.log lands in
  // v26.6.0, and the snapshots are keyed by node major, so a fixture would make
  // v26.4 and v26.6 disagree over one snapshot.
  const emit = async (data) => {
    const reporter = (await import('../index.js')).default;
    let out = '';
    reporter._transform({ type: 'test:log', data }, null, (err, chunk) => {
      if (err) throw err;
      out = chunk ?? '';
    });
    return out;
  };

  test('a log renders inline at its nesting', async () => {
    const out = await emit({
      name: 't', nesting: 2, file: 'x.js', line: 3, column: 1, message: 'fetched user',
    });
    assert.match(out, /fetched user/);
    assert.match(out, /^ {4}/, 'indented two levels');
  });

  test('a log payload renders after the message', async () => {
    const out = await emit({
      name: 't', nesting: 0, file: 'x.js', line: 3, column: 1, message: 'fetched', data: { userId: 42 },
    });
    assert.match(out, /fetched \{"userId":42\}/);
  });

  test('a payload JSON cannot render falls back instead of throwing', async () => {
    // This reporter reads raw node events, not wire-sanitized ones, so a
    // circular payload reaches it intact — what a user gets under
    // --test-isolation=none.
    const circular = { name: 'c' };
    circular.self = circular;
    const out = await emit({
      name: 't', nesting: 0, file: 'x.js', line: 3, column: 1, message: 'circular', data: circular,
    });
    assert.match(out, /circular \[object Object\]/);
  });

  test('a log at line 1 column 1 still renders, unlike a top-level diagnostic', async () => {
    // A run-level counts line is what isTopLevelDiagnostic() suppresses; a log
    // always names a real test, so the same rule must not filter it.
    const out = await emit({
      name: 't', nesting: 0, file: 'x.js', line: 1, column: 1, message: 'still shown',
    });
    assert.match(out, /still shown/);
  });
});
