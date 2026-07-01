// Edge cases ported from eon-service's slack-reporter test suite
// (workflow-tests/ts-tests/tests/slack-reporter.test.ts), which exercises the
// same node:test event stream this store consumes.
import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent, TestNode } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const captureReporter = join(here, 'capture-reporter.mjs');

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

/** All nodes matching a name, each paired with its ancestor-name path. */
function findAll(root: TestNode, name: string): { node: TestNode; path: string[] }[] {
  const found: { node: TestNode; path: string[] }[] = [];
  (function walk(node: TestNode, path: string[]) {
    if (node.name === name) found.push({ node, path });
    node.children.forEach((child) => walk(child, [...path, node.name]));
  }(root, []));
  return found;
}

function findOne(root: TestNode, name: string): { node: TestNode; path: string[] } {
  const matches = findAll(root, name);
  assert.strictEqual(matches.length, 1, `expected exactly one node named "${name}", got ${matches.length}`);
  return matches[0];
}

test('deeply nested failures (3+ suite levels) keep the full chain', () => {
  const { root, counts } = build(captureEvents(['fixtures/deeply-nested.mjs']));

  const { node, path } = findOne(root, 'postgres-encrypted');
  assert.strictEqual(node.status, 'failed');
  assert.deepStrictEqual(path.slice(-3), ['cloud provider', 'AWS', 'RDS']);
  assert.strictEqual(counts.failed, 1);
  // every enclosing suite reflects the failure
  for (const name of ['cloud provider', 'AWS', 'RDS']) {
    assert.strictEqual(findOne(root, name).node.status, 'failed', `${name} should be failed`);
  }
});

test('duplicate test names across suites stay distinct', () => {
  const { root, counts } = build(captureEvents(['fixtures/duplicate-names.mjs']));

  const matches = findAll(root, 'connectivity');
  assert.strictEqual(matches.length, 2);
  assert.deepStrictEqual(
    matches.map(({ path }) => path[path.length - 1]).sort(),
    ['suite-1', 'suite-2'],
  );
  for (const { node } of matches) assert.strictEqual(node.status, 'failed');
  assert.strictEqual(counts.failed, 2);
});

test('loop-generated tests sharing a source location stay distinct (ambiguous tests)', () => {
  const { root, counts } = build(captureEvents(['fixtures/ambiguous-tests.mjs']));

  const matches = findAll(root, 'check connectivity');
  assert.strictEqual(matches.length, 2);
  // both instances share line:column, so only the suite path can tell them apart
  assert.deepStrictEqual(
    matches.map(({ path }) => path[path.length - 1]).sort(),
    ['region-1', 'region-2'],
  );
  assert.strictEqual(counts.failed, 2);
});

test('cancelled-by-parent subtests (duplicate test:complete emits) do not duplicate nodes', () => {
  const { root } = build(captureEvents(['fixtures/cancelled-by-parent.mjs']));

  // The timed-out parent's cancelled subtests may emit test:complete twice
  // (at cancellation and again during parent teardown); each test must still
  // appear exactly once, at its full hierarchy.
  const object = findOne(root, 'restore object');
  const bucket = findOne(root, 'restore bucket');
  assert.deepStrictEqual(object.path.slice(-3), ['OUTER', 'should cancel by timeout', 'middle']);
  assert.deepStrictEqual(bucket.path.slice(-3), ['OUTER', 'should cancel by timeout', 'middle']);
  assert.strictEqual(object.node.status, 'failed');
  assert.strictEqual(bucket.node.status, 'failed');
  assert.strictEqual(findOne(root, 'should cancel by timeout').node.status, 'failed');
});

test('concurrent factory subtests at one source location attribute completes correctly', () => {
  const { root, counts } = build(captureEvents(['fixtures/concurrent-same-location.mjs']));

  const matches = findAll(root, 'e2e');
  assert.strictEqual(matches.length, 4);
  // exactly one instance fails, and it is test-C's — a passing sibling must
  // not have consumed the failing instance's early test:complete
  const failed = matches.filter(({ node }) => node.status === 'failed');
  assert.strictEqual(failed.length, 1);
  assert.strictEqual(failed[0].path[failed[0].path.length - 1], 'test-C (fails)');
  assert.strictEqual(counts.failed >= 1, true);
  assert.strictEqual(matches.filter(({ node }) => node.status === 'passed').length, 3);
});

test('a subtest defined in a helper file attaches under its parent from the entry file', {
  todo: 'known failure: the store resolves parentId inside the helper file group, creating a phantom parent',
}, () => {
  const { root } = build(captureEvents(['fixtures/entry-with-helper-subtest.mjs']));

  // The subtest's events report file=subtest-helper.mjs while its parent
  // reports the entry file; it must still hang off its actual parent.
  const { node, path } = findOne(root, 'subtest');
  assert.strictEqual(node.status, 'failed');
  assert.ok(
    path.includes('has subtests in another file'),
    `subtest should be a descendant of its parent test, got path: ${JSON.stringify(path)}`,
  );
});

test('cross-process testId collision: helper subtest attaches to the still-open parent', {
  todo: 'known failure: the store resolves parentId inside the helper file group, creating a phantom parent',
}, () => {
  // Merged multi-process stream (can't be reproduced in-process): isolation
  // gives each file its own testId counter, so file 3's `it` and file 4's `it`
  // are both testId 2. `consistency check` is defined in a helper, so its
  // events carry file=helper and must resolve their parent to the still-open
  // parent (file 3), not the collided, already-finished parent (file 4).
  const F3 = '/repo/tests/3_rds-schema-test.test.ts';
  const F4 = '/repo/tests/4_rds_clone_fallback.test.ts';
  const HELPER = '/repo/tests/rds.ts';

  const enqueue = (testId: number, parentId: number, file: string, name: string, nesting: number): TestEvent => (
    { type: 'test:enqueue', data: { testId, parentId, file, name, nesting } }
  );
  const complete = (testId: number, parentId: number, file: string, name: string, nesting: number, passed: boolean): TestEvent => (
    { type: 'test:complete', data: { testId, parentId, file, name, nesting, details: { passed, error: passed ? undefined : new Error('intentional') } } }
  );

  const { root } = build([
    enqueue(1, 0, F3, 'RDS schema test', 0),
    enqueue(2, 1, F3, 'schema-test pg-schema-test', 1),
    enqueue(1, 0, F4, 'RDS clone fallback to snapshot', 0),
    enqueue(2, 1, F4, 'backup succeeds via snapshot fallback', 1),
    // file 4's quick backup finishes well before file 3's long-running
    // consistency check is even enqueued
    complete(2, 1, F4, 'backup succeeds via snapshot fallback', 1, true),
    complete(1, 0, F4, 'RDS clone fallback to snapshot', 0, true),
    enqueue(3, 2, HELPER, 'consistency check', 2),
    complete(3, 2, HELPER, 'consistency check', 2, false),
  ]);

  const { node, path } = findOne(root, 'consistency check');
  assert.strictEqual(node.status, 'failed');
  assert.ok(
    path.includes('schema-test pg-schema-test'),
    `consistency check should be a descendant of file 3's subtest, got path: ${JSON.stringify(path)}`,
  );
  assert.ok(
    !path.some((name) => name.includes('4_rds_clone_fallback')),
    'must not attach under the collided, finished parent from file 4',
  );
});
