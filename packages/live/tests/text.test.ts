import { test } from 'node:test';
import assert from 'node:assert';
import { createTreeStore } from '@reporters/tree-core';
import type { TestEvent } from '@reporters/tree-core';
import { renderTreeText } from '../src/text.ts';

function build(events: TestEvent[]) {
  const store = createTreeStore();
  for (const event of events) store.apply(event);
  return store.getSnapshot();
}

test('renders an indented tree with status symbols and durations', () => {
  const snapshot = build([
    { type: 'test:start', data: { name: 'math', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:start', data: { name: 'adds', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1 } },
    { type: 'test:pass', data: { name: 'adds', nesting: 1, file: '/a.test.js', testId: 2, parentId: 1, details: { duration_ms: 3 } } },
    { type: 'test:fail', data: { name: 'math', nesting: 0, file: '/a.test.js', testId: 1, details: { type: 'suite', duration_ms: 9 } } },
  ]);

  const text = renderTreeText(snapshot);
  assert.match(text, /a\.test\.js/);
  assert.match(text, /✔ adds \(3ms\)/);
  assert.match(text, /✖ math/);
  // the passing test is indented deeper than its suite
  const lines = text.split('\n');
  const suiteLine = lines.find((l) => l.includes('math'))!;
  const testLine = lines.find((l) => l.includes('adds'))!;
  assert.ok(testLine.indexOf('✔') > suiteLine.indexOf('✖'), 'child indented deeper than parent');
});

test('shows the error message under a failed leaf test', () => {
  const snapshot = build([
    { type: 'test:start', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:fail', data: { name: 't', nesting: 0, file: '/a.test.js', testId: 1, details: { error: new Error('expected 1 to equal 2') } } },
  ]);
  const text = renderTreeText(snapshot);
  assert.match(text, /expected 1 to equal 2/);
});

test('renders a summary line from the counts', () => {
  const snapshot = build([
    { type: 'test:pass', data: { name: 'a', nesting: 0, file: '/a.test.js', testId: 1 } },
    { type: 'test:fail', data: { name: 'b', nesting: 0, file: '/a.test.js', testId: 2 } },
  ]);
  const text = renderTreeText(snapshot);
  assert.match(text, /1 passed/);
  assert.match(text, /1 failed/);
});
