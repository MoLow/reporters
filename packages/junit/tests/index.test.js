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

test('logs and diagnostics both render as XML comments, like the native reporter', async () => {
  const lines = [];
  const events = [
    { type: 'test:start', data: { name: 'suite', nesting: 0 } },
    { type: 'test:log', data: { name: 'suite', nesting: 1, message: 'a log line' } },
    { type: 'test:diagnostic', data: { nesting: 1, message: 'a diagnostic' } },
    { type: 'test:pass', data: { name: 'suite', nesting: 0, details: { duration_ms: 1 } } },
  ];
  for await (const line of reporter(events)) {
    lines.push(line);
  }
  const xml = lines.join('');
  assert.match(xml, /<!-- a log line -->/);
  assert.match(xml, /<!-- a diagnostic -->/);
});

test('a comment-only test stays a testcase and is not counted as a suite', async () => {
  const lines = [];
  const events = [
    { type: 'test:start', data: { name: 'leaf', nesting: 0 } },
    { type: 'test:log', data: { name: 'leaf', nesting: 1, message: 'note' } },
    { type: 'test:pass', data: { name: 'leaf', nesting: 0, details: { duration_ms: 1 } } },
  ];
  for await (const line of reporter(events)) {
    lines.push(line);
  }
  const xml = lines.join('');
  assert.match(xml, /<testcase /, 'a test whose only children are comments is still a testcase');
  assert.doesNotMatch(xml, /<testsuite /);
  assert.match(xml, /<!-- note -->/);
});

test('a comment escapes the double hyphen that would close it early', async () => {
  const lines = [];
  const events = [
    { type: 'test:start', data: { name: 'leaf', nesting: 0 } },
    { type: 'test:log', data: { name: 'leaf', nesting: 1, message: 'before -- after' } },
    { type: 'test:pass', data: { name: 'leaf', nesting: 0, details: { duration_ms: 1 } } },
  ];
  for await (const line of reporter(events)) {
    lines.push(line);
  }
  assert.match(lines.join(''), /<!-- before &#45;&#45; after -->/);
});

test('a log outside any test becomes a root-level comment', async () => {
  const lines = [];
  for await (const line of reporter([{ type: 'test:log', data: { nesting: 0, message: 'orphan' } }])) {
    lines.push(line);
  }
  assert.match(lines.join(''), /<!-- orphan -->/);
});
