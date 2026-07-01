import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent, TestNode } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const captureReporter = join(here, 'capture-reporter.mjs');

// `--test-isolation` was not available on older Node (e.g. v22), where it errors
// with "bad option". Feature-detect so we can skip the isolation=none case there.
const isolationFlagSupported = spawnSync(process.execPath, ['--help'], { encoding: 'utf8' })
  .stdout.includes('--test-isolation');

function captureEvents(files: string[], extraArgs: string[] = []): TestEvent[] {
  // Strip NODE_TEST_CONTEXT so the spawned runner does not think it is a child
  // of this test process (which would make it serialize to a fd, not stdout).
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const child = spawnSync(
    process.execPath,
    ['--test', ...extraArgs, '--test-reporter', captureReporter, '--test-reporter-destination', 'stdout', ...files],
    { cwd: here, encoding: 'utf8', env },
  );
  return (child.stdout ?? '').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as TestEvent);
}

function build(events: TestEvent[]) {
  const store = createTreeStore();
  for (const event of events) store.apply(event);
  return store.getSnapshot();
}

function leaf(node: TestNode, name: string): TestNode | undefined {
  if (node.name === name && node.children.length === 0) return node;
  for (const child of node.children) {
    const found = leaf(child, name);
    if (found) return found;
  }
  return undefined;
}

// A real concurrent run, captured once, for the live-ordering guard below.
const concurrentStream = captureEvents(['fixtures/concurrent-suite.mjs']);
const liveComplete = concurrentStream.some((e) => e.type === 'test:complete' && e.data.testId != null);

test('a fast test finalizes before its slower, first-declared sibling (live order)', {
  skip: liveComplete ? false : 'this Node build lacks testId on test:complete',
}, () => {
  // 'slow' (20ms) is declared before 'fast' (1ms). Replay the real stream only
  // up to the moment 'fast' completes: 'fast' must already be done while 'slow'
  // is still running — i.e. completion is driven by execution-ordered
  // test:complete, not the declaration-ordered (buffered) test:pass.
  const idx = concurrentStream.findIndex((e) => e.type === 'test:complete' && e.data.name === 'fast');
  assert.ok(idx >= 0, 'expected a test:complete for "fast"');

  const store = createTreeStore();
  for (const event of concurrentStream.slice(0, idx + 1)) store.apply(event);

  const status: Record<string, string> = {};
  (function walk(node: TestNode) {
    node.children.forEach((c) => { status[c.name] = c.status; walk(c); });
  }(store.getSnapshot().root));

  assert.strictEqual(status.fast, 'passed', 'fast should be done');
  assert.strictEqual(status.slow, 'running', 'slow should still be running, not waiting on declaration order');
});

test('isolation: shared-helper tests from two files group under the definition file', () => {
  // KNOWN LIMITATION: tests defined in a shared, imported module report the
  // definition file (not the entry file) and, under process isolation, reset
  // testId per process. Grouping by file (required for a live tree — see the
  // model in store.ts) therefore merges the two files' identical tests. The
  // final, cumulative summary still reports the true totals.
  // See docs/node-issue-entry-file-attribution.md.
  const events = captureEvents(['fixtures/entry-a.mjs', 'fixtures/entry-b.mjs']);
  const { root, summary } = build(events);

  const fileNodes = root.children.filter((n) => n.type === 'file');
  assert.strictEqual(fileNodes.length, 1, 'both files define via the same helper');
  assert.ok(fileNodes[0].name.endsWith('shared-helper.mjs'));
  assert.strictEqual(leaf(fileNodes[0], 'shared passing test')?.status, 'passed');
  assert.strictEqual(leaf(fileNodes[0], 'shared failing test')?.status, 'failed');

  // The run-level summary still reflects that 4 tests actually ran.
  assert.strictEqual(summary?.counts.tests, 4);
  assert.strictEqual(summary?.counts.passed, 2);
  assert.strictEqual(summary?.counts.failed, 2);
});

test('isolation=none: shared helper tests group under the definition file, all distinct', {
  skip: isolationFlagSupported ? false : 'this Node build does not support --test-isolation',
}, () => {
  const events = captureEvents(['fixtures/entry-a.mjs', 'fixtures/entry-b.mjs'], ['--test-isolation=none']);
  const { root } = build(events);

  assert.deepStrictEqual(
    { passed: root.counts.passed, failed: root.counts.failed, total: root.counts.total },
    { passed: 2, failed: 2, total: 4 },
  );
});

test('real concurrent stream builds the suite with all subtests', () => {
  const events = captureEvents(['fixtures/concurrent-suite.mjs']);
  const { root } = build(events);

  const names: string[] = [];
  (function walk(node: TestNode) {
    if (node.children.length === 0 && (node.type === 'test' || node.type === 'suite')) names.push(node.name);
    node.children.forEach(walk);
  }(root));
  assert.deepStrictEqual(names.sort(), ['fast', 'medium', 'slow']);
  assert.strictEqual(root.counts.passed, 3);
  assert.strictEqual(root.counts.failed, 0);
});

test('concurrent sibling suites keep their own children (nesting-stack correctness)', () => {
  // Guards that overlapping sibling suites are correctly parented on every Node
  // version — via parentId where available, and via the nesting stack on builds
  // (e.g. v22) that emit neither testId nor parentId.
  const events = captureEvents(['fixtures/concurrent-siblings.mjs']);
  const { root } = build(events);

  const suites: Record<string, string[]> = {};
  (function walk(node: TestNode) {
    if (node.type === 'suite') suites[node.name] = node.children.map((c) => c.name).sort();
    node.children.forEach(walk);
  }(root));

  assert.deepStrictEqual(suites['suite A'], ['a1', 'a2']);
  assert.deepStrictEqual(suites['suite B'], ['b1', 'b2']);
  assert.strictEqual(root.counts.passed, 4);
  assert.strictEqual(root.counts.failed, 0);
});

test('top-level stdout/stderr attach to the same file node as the tests', () => {
  // Node reports test:stdout/test:stderr with the CLI-relative file path, while
  // the test lifecycle events report the resolved absolute path. Both must land
  // on a single file node — not split into a stdout-only node and a tests node.
  const events = captureEvents(['fixtures/stdout-toplevel.mjs']);
  const { root } = build(events);

  const fileNodes = root.children.filter((n) => n.type === 'file');
  assert.strictEqual(fileNodes.length, 1, 'stdout and tests must share one file node');
  assert.ok(fileNodes[0].stdout.some((s) => s.includes('top-level stdout')));
  assert.ok(fileNodes[0].stderr.some((s) => s.includes('top-level stderr')));
  assert.strictEqual(leaf(fileNodes[0], 'a passing test')?.status, 'passed');
});

test('replaying the captured real stream into a fresh store is deterministic', () => {
  // This is how the web viewer rebuilds on a full refetch: a fresh store,
  // replayed from the start, must always yield the identical tree.
  const events = captureEvents(['fixtures/entry-a.mjs', 'fixtures/entry-b.mjs']);
  const a = build(events);
  const b = build(events);
  assert.deepStrictEqual(a.counts, b.counts);
  assert.strictEqual(a.root.children.length, b.root.children.length);
  assert.deepStrictEqual(
    a.root.children.map((f) => [f.name, f.children.length]),
    b.root.children.map((f) => [f.name, f.children.length]),
  );
});
