import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '@reporters/tree-core';
import type { TestEvent, TestNode } from '@reporters/tree-core';
import { buildRows, hasDiagnostics } from '../src/client/rowModel.ts';

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
