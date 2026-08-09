import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '../src/store.ts';
import type { TestEvent } from '../src/types.ts';

function apply(store: ReturnType<typeof createTreeStore>, events: TestEvent[]) {
  for (const event of events) store.apply(event);
}

const FILE = '/a.test.js';

function nested() {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'math', nesting: 0, file: FILE, testId: 1 } },
    { type: 'test:start', data: { name: 'adds', nesting: 1, file: FILE, testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'adds', nesting: 1, file: FILE, testId: 2, parentId: 1, details: { duration_ms: 1 } } },
    { type: 'test:pass', data: { name: 'math', nesting: 0, file: FILE, testId: 1, details: { duration_ms: 3, type: 'suite' } } },
  ]);
  const { root } = store.getSnapshot();
  const fileNode = root.children[0];
  const suite = fileNode.children[0];
  return { root, fileNode, suite, leaf: suite.children[0] };
}

test('parent links every node to the one above it, and is absent on the root', () => {
  const { root, fileNode, suite, leaf } = nested();

  assert.strictEqual(leaf.parent, suite);
  assert.strictEqual(suite.parent, fileNode);
  assert.strictEqual(fileNode.parent, root);
  assert.strictEqual(root.parent, undefined);
});

test('parent agrees with the parentKey the node already carried', () => {
  const { fileNode, suite, leaf } = nested();

  for (const node of [fileNode, suite, leaf]) {
    assert.strictEqual(node.parent!.key, node.parentKey);
  }
});

test('ancestors walks root-first and excludes the node itself', () => {
  const { root, fileNode, suite, leaf } = nested();

  assert.deepStrictEqual(leaf.ancestors(), [root, fileNode, suite]);
  assert.deepStrictEqual(suite.ancestors(), [root, fileNode]);
  assert.deepStrictEqual(fileNode.ancestors(), [root]);
  assert.deepStrictEqual(root.ancestors(), []);
});

test('ancestors of a node in a second file stay within that file', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'a', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'a', nesting: 0, file: '/a.test.js', testId: 1, details: { duration_ms: 1 } } },
    { type: 'test:start', data: { name: 'b', nesting: 0, file: '/b.test.js', testId: 1 } },
    { type: 'test:pass', data: { name: 'b', nesting: 0, file: '/b.test.js', testId: 1, details: { duration_ms: 1 } } },
  ]);

  const { root } = store.getSnapshot();
  const [fileA, fileB] = root.children;

  assert.deepStrictEqual(fileB.children[0].ancestors(), [root, fileB]);
  assert.deepStrictEqual(fileA.children[0].ancestors(), [root, fileA]);
});

// The tree is rebuilt on every dirty snapshot, so lineage must point inside the
// snapshot the node came from — the same rule `children` already follows.
test('each snapshot links its own nodes, not the previous snapshot\'s', () => {
  const store = createTreeStore();
  apply(store, [
    { type: 'test:start', data: { name: 'adds', nesting: 0, file: FILE, testId: 1 } },
  ]);
  const first = store.getSnapshot();
  apply(store, [
    { type: 'test:pass', data: { name: 'adds', nesting: 0, file: FILE, testId: 1, details: { duration_ms: 5 } } },
  ]);
  const second = store.getSnapshot();

  assert.notStrictEqual(second.root, first.root);
  assert.strictEqual(second.root.children[0].children[0].parent, second.root.children[0]);
  assert.strictEqual(first.root.children[0].children[0].parent, first.root.children[0]);
});

// The back-reference would make the tree cyclic to anything that walks own
// enumerable properties, so both members must be invisible to them.
test('lineage members are non-enumerable and leave serialization untouched', () => {
  const { root, leaf } = nested();

  assert.ok(!Object.keys(leaf).includes('parent'));
  assert.ok(!Object.keys(leaf).includes('ancestors'));
  assert.ok(!('parent' in JSON.parse(JSON.stringify(root))));
  assert.strictEqual(structuredClone(root).children[0].children[0].name, 'math');
});

test('two structurally identical trees still deep-equal each other', () => {
  assert.deepStrictEqual(nested().root, nested().root);
});
