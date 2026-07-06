// The tree must show tests in the order the native spec reporter reports them:
// files in runner enqueue order (sorted discovery order), tests in declaration
// order within a file. Execution-ordered (eager) events arrive in wall-clock
// order across concurrent processes, so placement from them is provisional;
// the declaration-ordered stream settles the final position.
import { test } from 'node:test';
import assert from 'node:assert';
import type { TestEvent } from '../src/types.ts';
import {
  build, done, ev, findOne,
} from './util.ts';

const A = '/x/tests/a.test.ts';
const B = '/x/tests/b.test.ts';
const HELPER = '/x/tests/utils.ts';

const wrapper = (file: string) => ({
  name: `tests/${file.split('/').pop()}`, nesting: 0, file, testId: 1, parentId: 0, type: 'test' as const,
});

test('file groups follow the runner enqueue order, not first-test-event order', () => {
  // The runner enqueues the file wrappers up front in sorted discovery order;
  // which file's process emits a test event first is a wall-clock race.
  const { root } = build([
    ev('test:enqueue', wrapper(A)),
    ev('test:dequeue', wrapper(A)),
    ev('test:enqueue', wrapper(B)),
    ev('test:dequeue', wrapper(B)),
    // B's process wins the race and reports its tests first.
    ev('test:enqueue', { name: 'b test', nesting: 0, file: B, testId: 2, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'b test', nesting: 0, file: B, testId: 2, parentId: 0, details: done }),
    ev('test:enqueue', { name: 'a test', nesting: 0, file: A, testId: 2, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'a test', nesting: 0, file: A, testId: 2, parentId: 0, details: done }),
    ev('test:start', { name: 'a test', nesting: 0, file: A, testId: 2, parentId: 0 }),
    ev('test:pass', { name: 'a test', nesting: 0, file: A, testId: 2, parentId: 0, details: done }),
    ev('test:start', { name: 'b test', nesting: 0, file: B, testId: 2, parentId: 0 }),
    ev('test:pass', { name: 'b test', nesting: 0, file: B, testId: 2, parentId: 0, details: done }),
  ]);
  assert.deepStrictEqual(root.children.map((n) => n.file), [A, B]);
});

test('declaration order settles sibling positions after an eager mis-link', () => {
  // Real pattern from a 39-file concurrent run: a helper-defined subtest's
  // eager enqueue carries an ambiguous parentId (testId 4 is open in another
  // process too), so it first links under the wrong parent. Its declaration
  // start re-links it under the real parent — and must land it in declaration
  // position (before "restore"), not appended after siblings that enqueued
  // later but were placed correctly on the first try.
  const { root } = build([
    // The real parent in file A.
    ev('test:enqueue', { name: 'backup', nesting: 1, file: A, testId: 4, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'backup', nesting: 1, file: A, testId: 4, parentId: 0, type: 'test' }),
    // Another process holds an open testId=4 at the same nesting — the decoy
    // the ambiguous eager resolution will pick (most recent match wins).
    ev('test:enqueue', { name: 'other parent', nesting: 1, file: B, testId: 4, parentId: 0, type: 'test' }),
    ev('test:dequeue', { name: 'other parent', nesting: 1, file: B, testId: 4, parentId: 0, type: 'test' }),
    // Declared first: helper-file subtest — ambiguous parentId across groups.
    ev('test:enqueue', { name: 'scan', nesting: 2, file: HELPER, testId: 25, parentId: 4, type: 'test' }),
    // Declared second: same-file subtest — resolves to "backup" directly.
    ev('test:enqueue', { name: 'restore', nesting: 2, file: A, testId: 26, parentId: 4, type: 'test' }),
    ev('test:complete', { name: 'scan', nesting: 2, file: HELPER, testId: 25, parentId: 4, details: done }),
    ev('test:complete', { name: 'restore', nesting: 2, file: A, testId: 26, parentId: 4, details: done }),
    ev('test:complete', { name: 'backup', nesting: 1, file: A, testId: 4, parentId: 0, details: done }),
    // Declaration-ordered block for file A.
    ev('test:start', { name: 'backup', nesting: 1, file: A, testId: 4, parentId: 0 }),
    ev('test:start', { name: 'scan', nesting: 2, file: HELPER, testId: 25, parentId: 4 }),
    ev('test:pass', { name: 'scan', nesting: 2, file: HELPER, testId: 25, parentId: 4, details: done }),
    ev('test:start', { name: 'restore', nesting: 2, file: A, testId: 26, parentId: 4 }),
    ev('test:pass', { name: 'restore', nesting: 2, file: A, testId: 26, parentId: 4, details: done }),
    ev('test:pass', { name: 'backup', nesting: 1, file: A, testId: 4, parentId: 0, details: done }),
  ]);
  const { node: backup } = findOne(root, 'backup');
  assert.deepStrictEqual(backup.children.map((n) => n.name), ['scan', 'restore']);
});

test('a re-delivered start leaves an already-settled node in place', () => {
  // A watch-mode reporter appending a rerun to the same stream re-delivers
  // starts with no dedup; a partial rerun must not shuffle settled siblings.
  const sibling = (name: string, testId: number): TestEvent[] => [
    ev('test:start', { name, nesting: 1, file: A, testId, parentId: 1 }),
    ev('test:pass', { name, nesting: 1, file: A, testId, parentId: 1, details: done }),
  ];
  const { root } = build([
    ev('test:start', { name: 'suite', nesting: 0, file: A, testId: 1, parentId: 0 }),
    ...sibling('first', 2),
    ...sibling('second', 3),
    ...sibling('third', 4),
    // rerun of "first" only
    ...sibling('first', 2),
    ev('test:pass', { name: 'suite', nesting: 0, file: A, testId: 1, parentId: 0, details: done }),
  ]);
  const { node: suite } = findOne(root, 'suite');
  assert.deepStrictEqual(suite.children.map((n) => n.name), ['first', 'second', 'third']);
});

test('root groups without a file wrapper settle in declaration-stream order', () => {
  // Shared helpers with top-level tests get no wrapper of their own; their
  // groups must not order by which process emits an eager event first.
  const H1 = '/x/tests/helperOne.ts';
  const H2 = '/x/tests/helperTwo.ts';
  const { root } = build([
    // Eager arrival order: helperTwo first (wall-clock race).
    ev('test:enqueue', { name: 'two', nesting: 0, file: H2, testId: 9, parentId: 0, type: 'test' }),
    ev('test:enqueue', { name: 'one', nesting: 0, file: H1, testId: 9, parentId: 0, type: 'test' }),
    ev('test:complete', { name: 'two', nesting: 0, file: H2, testId: 9, parentId: 0, details: done }),
    ev('test:complete', { name: 'one', nesting: 0, file: H1, testId: 9, parentId: 0, details: done }),
    // Declaration-ordered stream reports helperOne's block first.
    ev('test:start', { name: 'one', nesting: 0, file: H1, testId: 9, parentId: 0 }),
    ev('test:pass', { name: 'one', nesting: 0, file: H1, testId: 9, parentId: 0, details: done }),
    ev('test:start', { name: 'two', nesting: 0, file: H2, testId: 9, parentId: 0 }),
    ev('test:pass', { name: 'two', nesting: 0, file: H2, testId: 9, parentId: 0, details: done }),
  ]);
  assert.deepStrictEqual(root.children.map((n) => n.file), [H1, H2]);
});
