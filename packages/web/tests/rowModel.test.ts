import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '@reporters/tree-core';
import type { Counts, TestEvent, TestNode } from '@reporters/tree-core';
import {
  buildRows, collectContainerKeys, computeMatches, displayName, hasDiagnostics,
  isDiagOpen, isExpanded, liveNodeDuration, nodeDuration, reasonOf, realError, rollup,
} from '../src/client/rowModel.ts';

const zeroCounts = (): Counts => ({
  passed: 0, failed: 0, skipped: 0, todo: 0, running: 0, queued: 0, total: 0,
});

function node(over: Partial<TestNode> = {}): TestNode {
  return {
    key: 'k', testId: undefined, parentKey: null, file: undefined, name: '',
    nesting: 0, type: 'test', status: 'passed', diagnostics: [], stdout: [], stderr: [],
    children: [], counts: zeroCounts(), ...over,
  };
}

const FILE = '/repo/foo.test.js';

/** A file with top-level stdout/stderr plus one passing test. */
const events: TestEvent[] = [
  // The file-level wrapper (relative name, absolute file) arrives before the
  // module's top-level output, mirroring the real node:test stream.
  { type: 'test:enqueue', data: { name: 'foo.test.js', file: FILE, nesting: 0 } },
  { type: 'test:stdout', data: { file: 'foo.test.js', message: 'hello out\n' } },
  { type: 'test:stderr', data: { file: 'foo.test.js', message: 'hello err\n' } },
  { type: 'test:start', data: { name: 't', nesting: 0, file: FILE, testId: 1 } },
  { type: 'test:pass', data: { name: 't', nesting: 0, file: FILE, testId: 1, details: { duration_ms: 1 } } },
];

function fileNode(): TestNode {
  const store = createTreeStore();
  for (const e of events) store.apply(e);
  const files = store.getSnapshot().root.children.filter((n) => n.type === 'file');
  assert.strictEqual(files.length, 1, 'stdout and tests share one file node');
  return files[0];
}

const noQuery = { overrides: new Map<string, boolean>(), query: '', matches: null };

test('a file node with its own stdout/stderr reports diagnostics', () => {
  assert.strictEqual(hasDiagnostics(fileNode()), true);
});

test('buildRows surfaces a diagnostics affordance on an expanded container file with output', () => {
  const rows = buildRows([fileNode()], noQuery);
  const fileRow = rows.find((r) => r.node.type === 'file')!;
  assert.strictEqual(fileRow.container, true, 'file has test children, so it is a container');
  assert.strictEqual(fileRow.expanded, true, 'a file defaults to expanded');
  assert.strictEqual(fileRow.hasDiag, true, 'an expanded container must expose its own stdout/stderr');
});

test('a collapsed container hides its own stdout/stderr along with its children', () => {
  const file = fileNode();
  const rows = buildRows([file], { overrides: new Map([[file.key, false]]), query: '', matches: null });
  const fileRow = rows.find((r) => r.node.type === 'file')!;
  assert.strictEqual(fileRow.expanded, false, 'the file is collapsed');
  assert.strictEqual(fileRow.hasDiag, false, 'a collapsed container must not surface its output');
  assert.strictEqual(fileRow.diagOpen, false);
});

test('displayName shows the basename for files and the raw name otherwise', () => {
  assert.strictEqual(displayName(node({ type: 'file', file: '/repo/pkg/app.test.js' })), 'app.test.js');
  assert.strictEqual(displayName(node({ type: 'file', file: 'C:\\repo\\win.test.js' })), 'win.test.js');
  assert.strictEqual(displayName(node({ type: 'file', file: undefined })), '<unknown>');
  assert.strictEqual(displayName(node({ type: 'file', file: '/' })), '/'); // trailing separator falls back to the raw path
  assert.strictEqual(displayName(node({ type: 'test', name: 'does a thing' })), 'does a thing');
});

test('rollup: leaves keep their status, containers take the worst descendant', () => {
  assert.strictEqual(rollup(node({ status: 'skipped' })), 'skipped');
  const leaf = node({ key: 'l' });
  const failed = node({ key: 'c', children: [leaf], counts: { ...zeroCounts(), failed: 1, passed: 1, total: 2 } });
  assert.strictEqual(rollup(failed), 'failed');
  // A container with children but no counted descendants falls through to passed.
  assert.strictEqual(rollup(node({ key: 'e', children: [leaf], counts: zeroCounts() })), 'passed');
});

test('reasonOf returns the skip/todo string, or undefined', () => {
  assert.strictEqual(reasonOf(node({ skip: 'not ready' })), 'not ready');
  assert.strictEqual(reasonOf(node({ todo: 'later' })), 'later');
  assert.strictEqual(reasonOf(node({ skip: true, todo: false })), undefined);
  assert.strictEqual(reasonOf(node()), undefined);
});

function sampleTree(): TestNode {
  const alpha = node({ key: 'l1', type: 'test', name: 'alpha' });
  const beta = node({ key: 'l2', type: 'test', name: 'beta' });
  const suite = node({ key: 's', type: 'suite', name: 'group', children: [alpha, beta] });
  return node({ key: 'f', type: 'file', file: '/repo/app.test.js', children: [suite] });
}

test('computeMatches marks a matched leaf and forces its ancestors open', () => {
  const file = sampleTree();
  const { visible, force } = computeMatches([file], 'alpha');
  assert.ok(visible.has('l1') && visible.has('s') && visible.has('f'));
  assert.ok(force.has('s') && force.has('f'), 'ancestors of a match are force-expanded');
  assert.ok(!force.has('l1'), 'the matched leaf itself is not force-expanded');
  assert.ok(!visible.has('l2'), 'a non-matching sibling stays hidden');
});

test('computeMatches on a file name reveals its whole subtree without forcing', () => {
  const { visible, force } = computeMatches([sampleTree()], 'app.test');
  assert.ok(visible.has('f') && visible.has('s') && visible.has('l1') && visible.has('l2'));
  assert.strictEqual(force.size, 0, 'a self-match reveals the subtree but forces nothing');
});

test('collectContainerKeys gathers file and suite keys, skipping leaves', () => {
  const keys: string[] = [];
  collectContainerKeys([sampleTree()], keys);
  assert.deepStrictEqual(keys, ['f', 's']);
});

test('isExpanded honors query force, overrides, then per-type defaults', () => {
  const opts = (over: Partial<Parameters<typeof isExpanded>[1]> = {}) => ({
    overrides: new Map<string, boolean>(), query: '', matches: null, ...over,
  });
  const suite = node({ key: 's', type: 'suite', children: [node()], counts: { ...zeroCounts(), failed: 1, total: 1 } });

  // A query match force-expands regardless of type/default.
  assert.strictEqual(isExpanded(suite, opts({ query: 'x', matches: { visible: new Set(), force: new Set(['s']) } })), true);
  // An explicit override wins over the default.
  assert.strictEqual(isExpanded(suite, opts({ overrides: new Map([['s', false]]) })), false);
  // Defaults: a failing suite opens, a fully-queued file stays closed, a leaf is closed.
  assert.strictEqual(isExpanded(suite, opts()), true);
  const runningSuite = node({ key: 'r', type: 'suite', children: [node()], counts: { ...zeroCounts(), running: 1, total: 1 } });
  assert.strictEqual(isExpanded(runningSuite, opts()), true, 'a running suite opens by default');
  const queuedFile = node({ key: 'f', type: 'file', children: [node()], counts: { ...zeroCounts(), queued: 2, total: 2 } });
  assert.strictEqual(isExpanded(queuedFile, opts()), false);
  assert.strictEqual(isExpanded(node({ key: 't', type: 'test' }), opts()), false);
});

test('isDiagOpen defaults to open only for failures, but an override wins', () => {
  assert.strictEqual(isDiagOpen(node({ key: 'a', status: 'failed' }), new Map()), true);
  assert.strictEqual(isDiagOpen(node({ key: 'a', status: 'passed' }), new Map()), false);
  assert.strictEqual(isDiagOpen(node({ key: 'a', status: 'failed' }), new Map([['a::diag', false]])), false);
  assert.strictEqual(isDiagOpen(node({ key: 'a', status: 'passed' }), new Map([['a::diag', true]])), true);
});

test('buildRows drops nodes filtered out by an active query', () => {
  const file = sampleTree();
  const matches = computeMatches([file], 'alpha');
  const rows = buildRows([file], { overrides: new Map(), query: 'alpha', matches });
  assert.ok(rows.some((r) => r.node.key === 'l1'), 'the matching leaf is kept');
  assert.ok(!rows.some((r) => r.node.key === 'l2'), 'the non-matching sibling is filtered out');
});

test('realError shows a failed leaf error but suppresses synthetic and container rollups', () => {
  // a real leaf error is returned as-is
  const leaf = node({ error: { message: 'expected 3 to equal 4', stack: 'at x' } });
  assert.deepStrictEqual(realError(leaf), { message: 'expected 3 to equal 4', stack: 'at x' });
  // Node's synthetic "N subtests failed" rollup on a leaf is dropped
  assert.strictEqual(realError(node({ error: { message: '1 subtest failed' } })), undefined);
  assert.strictEqual(realError(node({ error: { message: '3 subtests failed' } })), undefined);
  // a container never renders its own error, even a genuine-looking one
  const container = node({
    error: { message: 'boom' },
    children: [node({ key: 'c' })],
    counts: { ...zeroCounts(), failed: 1, total: 1 },
  });
  assert.strictEqual(realError(container), undefined);
  // a leaf with no error has none
  assert.strictEqual(realError(node()), undefined);
  // a leaf error with no message isn't synthetic — it's shown as-is
  const noMsg = { message: undefined as unknown as string };
  assert.strictEqual(realError(node({ error: noMsg })), noMsg);
});

test('hasDiagnostics ignores a suppressed (synthetic/container) error', () => {
  // a container whose only "diagnostic" is a synthetic rollup error has nothing to show
  const container = node({
    error: { message: '1 subtest failed' },
    children: [node({ key: 'c' })],
    counts: { ...zeroCounts(), failed: 1, total: 1 },
  });
  assert.strictEqual(hasDiagnostics(container), false);
  // a failed leaf with a real error does have diagnostics
  assert.strictEqual(hasDiagnostics(node({ error: { message: 'real' } })), true);
});

test('nodeDuration prefers a measured wall-clock over summing concurrent children', () => {
  const child = (key: string) => node({ key, durationMs: 600_000 });
  const measured = node({
    key: 'file', type: 'file', durationMs: 700_000, children: [child('a'), child('b'), child('c')],
  });
  assert.strictEqual(nodeDuration(measured), 700_000, 'measured wall-clock wins');
  const unmeasured = node({ key: 'suite', type: 'suite', children: [child('a'), child('b')] });
  assert.strictEqual(nodeDuration(unmeasured), 1_200_000, 'falls back to summing when unmeasured');
  assert.strictEqual(nodeDuration(child('leaf')), 600_000);
  assert.strictEqual(nodeDuration(node({ key: 'q', status: 'queued' })), 0, 'an unmeasured leaf has no duration');
});

test('liveNodeDuration ticks running leaves but keeps measured containers fixed', () => {
  const since = new Map<string, number>();
  const running = node({ key: 'r', status: 'running' });
  const done = node({ key: 'd', durationMs: 50 });
  const parent = node({ key: 'p', type: 'suite', children: [running, done] });
  assert.strictEqual(liveNodeDuration(parent, 1000, since), 50, 'first sight starts the running clock at 0');
  assert.strictEqual(liveNodeDuration(parent, 1300, since), 350, 'running leaf ticks with elapsed time');
  const measured = node({ key: 'm', type: 'suite', durationMs: 80, children: [done] });
  assert.strictEqual(liveNodeDuration(measured, 9999, since), 80, 'a completed, measured container is fixed');
  assert.strictEqual(liveNodeDuration(node({ key: 'q', status: 'queued' }), 9999, since), 0, 'an unmeasured, not-running leaf has no duration');
});
