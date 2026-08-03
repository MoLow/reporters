import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert';
import reporter from '../index.js';
import { Snap, nodeMajor } from '../../../tests/utils.js';

const snapshot = Snap(`${import.meta.filename}.${nodeMajor}`);
const pkgDir = join(import.meta.dirname, '..');

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {}, cwd: pkgDir });
  await snapshot(child);
});

test('spawn with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {}, cwd: pkgDir });
  await snapshot(child);
});

test('empty', async () => {
  const lines = [];
  for await (const line of reporter([])) {
    lines.push(line);
  }

  assert.deepStrictEqual(
    snapshot.snap.serialize(lines),
    await snapshot.snap(snapshot.snap.serialize(lines)),
  );
});

test('single test', async () => {
  const lines = [];
  for await (const line of reporter([{ type: 'test:pass', data: { name: 'test', nesting: 0, details: { duration_ms: 100 } } }])) {
    lines.push(line);
  }
  assert.deepStrictEqual(
    snapshot.snap.serialize(lines),
    await snapshot.snap(snapshot.snap.serialize(lines)),
  );
});

const render = async (events) => {
  const lines = [];
  for await (const line of reporter(events)) {
    lines.push(line);
  }
  return lines.join('');
};

const log = (name, testId, message) => ({
  type: 'test:log',
  data: {
    name, nesting: 1, file: 'a.test.js', testId, message,
  },
});

const passed = (name, testId) => ({
  type: 'test:pass',
  data: {
    name, nesting: 0, file: 'a.test.js', testId, details: { duration_ms: 1 },
  },
});

const started = (name) => ({ type: 'test:start', data: { name, nesting: 0 } });

test('logs and diagnostics both render as XML comments, like the native reporter', async () => {
  const xml = await render([
    started('suite'),
    log('suite', 1, 'a log line'),
    { type: 'test:diagnostic', data: { nesting: 1, message: 'a diagnostic' } },
    passed('suite', 1),
  ]);
  assert.match(xml, /<!-- a log line -->/);
  assert.match(xml, /<!-- a diagnostic -->/);
});

test('a comment-only test stays a testcase and is not counted as a suite', async () => {
  const xml = await render([started('leaf'), log('leaf', 1, 'note'), passed('leaf', 1)]);
  assert.match(xml, /<testcase /, 'a test whose only children are comments is still a testcase');
  assert.doesNotMatch(xml, /<testsuite /);
  assert.match(xml, /<!-- note -->/);
});

test('several logs from one test keep their order', async () => {
  const xml = await render([
    started('leaf'),
    log('leaf', 1, 'first'),
    log('leaf', 1, 'second'),
    passed('leaf', 1),
  ]);
  assert.match(xml, /<!-- first -->\s*<!-- second -->/);
});

test('a comment escapes the double hyphen that would close it early', async () => {
  const xml = await render([
    started('leaf'),
    log('leaf', 1, 'before -- after'),
    passed('leaf', 1),
  ]);
  assert.match(xml, /<!-- before &#45;&#45; after -->/);
});

test('a log lands inside its own testcase, not the one reporting when it arrived', async () => {
  // `test:log` is execution-ordered, so a log emitted by a still-running test
  // arrives while an unrelated test is being reported.
  const xml = await render([
    started('first'),
    log('second', 2, 'from the second test'),
    passed('first', 1),
    started('second'),
    passed('second', 2),
  ]);
  assert.match(
    xml,
    /<testcase name="first"[^>]*\/>[\s\S]*<testcase name="second"[^>]*>\s*<!-- from the second test -->/,
  );
});

test('logs from concurrent files stay with their own file', async () => {
  const xml = await render([
    {
      type: 'test:log',
      data: {
        name: 'b', nesting: 1, file: 'b.test.js', testId: 1, message: 'from b',
      },
    },
    started('a'),
    log('a', 1, 'from a'),
    passed('a', 1),
    started('b'),
    {
      type: 'test:pass',
      data: {
        name: 'b', nesting: 0, file: 'b.test.js', testId: 1, details: { duration_ms: 1 },
      },
    },
  ]);
  assert.match(xml, /<testcase name="a"[^>]*>\s*<!-- from a -->/);
  assert.match(xml, /<testcase name="b"[^>]*>\s*<!-- from b -->/);
});

test('a log outside any test becomes a root-level comment', async () => {
  assert.match(await render([{ type: 'test:log', data: { nesting: 0, message: 'orphan' } }]), /<!-- orphan -->/);
});

test('a log whose test never reports still reaches the document', async () => {
  const xml = await render([
    started('interrupted'),
    log('interrupted', 1, 'never claimed'),
  ]);
  assert.match(xml, /<!-- never claimed -->/);
});
