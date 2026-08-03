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
  // v26.4 and v26.6 disagree over one snapshot. Each case gets its own module
  // instance, since the reporter is a singleton holding buffered logs and the
  // inner spec reporter's nesting state.
  let instance = 0;

  const load = async () => {
    instance += 1;
    return (await import(`../index.js?case=${instance}`)).default;
  };

  const feed = (reporter, events) => events.map((event) => {
    let out = '';
    reporter._transform(event, null, (err, chunk) => {
      if (err) throw err;
      out = chunk ?? '';
    });
    return out;
  }).join('');

  const flush = (reporter) => new Promise((resolve, reject) => {
    reporter._flush((err, chunk) => (err ? reject(err) : resolve(chunk ?? '')));
  });

  const log = (data) => ({
    type: 'test:log',
    data: {
      name: 't', nesting: 0, file: 'x.js', line: 3, column: 1, testId: 1, ...data,
    },
  });

  const passed = (data) => ({
    type: 'test:pass',
    data: {
      name: 't', nesting: 0, file: 'x.js', line: 3, column: 1, testId: 1, details: { duration_ms: 1 }, ...data,
    },
  });

  const lineWith = (out, needle) => out.split('\n').find((line) => line.includes(needle));

  test('a log renders inline at its nesting, once its test reports', async () => {
    const reporter = await load();
    const held = feed(reporter, [log({ nesting: 2, message: 'fetched user' })]);
    assert.doesNotMatch(held, /fetched user/, 'held until the test reports');

    const out = feed(reporter, [passed({ nesting: 2 })]);
    assert.match(out, /fetched user/);
    assert.match(lineWith(out, 'fetched user'), /^ {4}/, 'indented two levels');
  });

  test('a log renders exactly once', async () => {
    // The upstream spec reporter renders test:log too; forwarding the event to
    // it as well as buffering here would print the line twice.
    const reporter = await load();
    const out = feed(reporter, [log({ message: 'only once' }), passed({})]);
    assert.strictEqual(out.split('only once').length - 1, 1);
  });

  test('several logs from one test keep their order', async () => {
    const reporter = await load();
    const out = feed(reporter, [log({ message: 'earlier' }), log({ message: 'later' }), passed({})]);
    assert.ok(out.indexOf('earlier') < out.indexOf('later'), out);
  });

  test('a log payload renders after the message', async () => {
    const reporter = await load();
    const out = feed(reporter, [log({ message: 'fetched', data: { userId: 42 } }), passed({})]);
    assert.match(out, /fetched \{"userId":42\}/);
  });

  test('a payload JSON cannot render falls back instead of throwing', async () => {
    // This reporter reads raw node events, not wire-sanitized ones, so a
    // circular payload reaches it intact — what a user gets under
    // --test-isolation=none.
    const circular = { name: 'c' };
    circular.self = circular;
    const reporter = await load();
    const out = feed(reporter, [log({ message: 'circular', data: circular }), passed({})]);
    assert.match(out, /circular \[object Object\]/);
  });

  test('a log at line 1 column 1 still renders, unlike a top-level diagnostic', async () => {
    // A run-level counts line is what isTopLevelDiagnostic() suppresses; a log
    // always names a real test, so the same rule must not filter it.
    const reporter = await load();
    const out = feed(reporter, [log({ line: 1, column: 1, message: 'still shown' }), passed({ line: 1, column: 1 })]);
    assert.match(out, /still shown/);
  });

  test('a log waits for its own test, not the next one to report', async () => {
    const reporter = await load();
    const other = feed(reporter, [
      log({ name: 'owner', testId: 7, message: 'owned line' }),
      passed({ name: 'bystander', testId: 8 }),
    ]);
    assert.doesNotMatch(other, /owned line/, 'must not leak into a foreign group');

    const owner = feed(reporter, [passed({ name: 'owner', testId: 7 })]);
    assert.match(owner, /owned line/);
  });

  test('logs from concurrent files stay with their own file', async () => {
    const reporter = await load();
    const first = feed(reporter, [
      log({ file: 'b.js', testId: 1, message: 'from b' }),
      passed({ file: 'a.js', testId: 1 }),
    ]);
    assert.doesNotMatch(first, /from b/, 'same testId, different file');
    assert.match(feed(reporter, [passed({ file: 'b.js', testId: 1 })]), /from b/);
  });

  // _flush writes the run summary; under Actions that would land in the real job
  // summary of whatever workflow is running these tests.
  const drain = async (reporter) => {
    const stepSummary = process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_STEP_SUMMARY;
    try {
      return await flush(reporter);
    } finally {
      if (stepSummary !== undefined) {
        process.env.GITHUB_STEP_SUMMARY = stepSummary;
      }
    }
  };

  test('a log whose test never reports is drained at the end of the run', async () => {
    const reporter = await load();
    feed(reporter, [log({ message: 'never claimed' })]);
    assert.match(await drain(reporter), /never claimed/);
  });

  test('drained logs get their own group under Actions', async () => {
    // The reporter reads GITHUB_ACTIONS once, at construction.
    const actions = process.env.GITHUB_ACTIONS;
    process.env.GITHUB_ACTIONS = 'true';
    let out;
    try {
      const reporter = await load();
      feed(reporter, [log({ message: 'stranded' })]);
      out = await drain(reporter);
    } finally {
      if (actions === undefined) {
        delete process.env.GITHUB_ACTIONS;
      } else {
        process.env.GITHUB_ACTIONS = actions;
      }
    }
    assert.match(out, /::group::Logs from tests that never reported/);
    assert.match(out, /stranded/);
    assert.match(out, /::endgroup::/);
  });
});
