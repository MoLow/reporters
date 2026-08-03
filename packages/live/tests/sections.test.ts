import { test } from 'node:test';
import assert from 'node:assert';
import type { TestMessage, TestNode } from '@reporters/tree-core';
import { diagnosticSections } from '../src/sections.ts';

const COUNTS = {
  passed: 1, failed: 0, skipped: 0, todo: 0, running: 0, queued: 0, carried: 0, total: 1,
};

function node(over: Partial<TestNode> = {}): TestNode {
  return {
    key: 'k',
    testId: 1,
    parentKey: null,
    file: '/a.test.js',
    name: 't',
    nesting: 0,
    type: 'test',
    status: 'passed',
    messages: [],
    stdout: [],
    stderr: [],
    children: [],
    counts: COUNTS,
    ...over,
  };
}

const log = (message: string, over: Partial<TestMessage> = {}): TestMessage => ({
  kind: 'log', message, level: 'info', ...over,
});

const diagnostic = (message: string, level: TestMessage['level'] = 'info'): TestMessage => ({
  kind: 'diagnostic', message, level,
});

function labels(target: TestNode): string[] {
  return diagnosticSections(target).map((section) => section.label);
}

test('a node with nothing to show has no sections', () => {
  assert.deepStrictEqual(diagnosticSections(node()), []);
});

test('logs and diagnostics share one section, in arrival order', () => {
  const sections = diagnosticSections(node({
    messages: [log('live one'), diagnostic('buffered'), log('live two')],
  }));
  assert.deepStrictEqual(labels(node({ messages: [log('x')] })), ['messages']);
  assert.strictEqual(sections.length, 1);
  assert.deepStrictEqual(sections[0].lines.map((l) => l.text), ['live one', 'buffered', 'live two']);
});

test('a log payload renders as a compact suffix', () => {
  const sections = diagnosticSections(node({
    messages: [log('fetched user', { data: { userId: 42 } })],
  }));
  assert.deepStrictEqual(sections[0].lines.map((l) => l.text), ['fetched user {"userId":42}']);
});

test('a payloadless log gets no trailing space', () => {
  const sections = diagnosticSections(node({ messages: [log('plain')] }));
  assert.strictEqual(sections[0].lines[0].text, 'plain');
});

test('each line is colored by its own level', () => {
  const sections = diagnosticSections(node({
    messages: [log('i'), log('w', { level: 'warn' }), diagnostic('e', 'error')],
  }));
  assert.deepStrictEqual(sections[0].lines.map((l) => l.color), [undefined, 'yellow', 'red']);
});

test('a multi-line message becomes one line per row, keeping its color', () => {
  const sections = diagnosticSections(node({
    messages: [log('first\nsecond', { level: 'warn' })],
  }));
  assert.deepStrictEqual(sections[0].lines, [
    { text: 'first', color: 'yellow' },
    { text: 'second', color: 'yellow' },
  ]);
});

test('error, messages, stdout and stderr appear in that order', () => {
  const target = node({
    error: { message: 'boom', stack: 'boom\n  at x' },
    messages: [log('m')],
    stdout: ['out\n'],
    stderr: ['err\n'],
  });
  assert.deepStrictEqual(labels(target), ['error', 'messages', 'stdout', 'stderr']);
});

test('the error section prefers the stack and is red', () => {
  const sections = diagnosticSections(node({ error: { message: 'boom', stack: 'boom\n  at x' } }));
  assert.deepStrictEqual(sections[0].lines, [
    { text: 'boom', color: 'red' },
    { text: '  at x', color: 'red' },
  ]);
});

test('an error without a stack falls back to its message', () => {
  const sections = diagnosticSections(node({ error: { message: 'no stack' } }));
  assert.deepStrictEqual(sections[0].lines.map((l) => l.text), ['no stack']);
});

test('a trailing newline is trimmed from stdout and stderr', () => {
  const sections = diagnosticSections(node({ stdout: ['a\nb\n'], stderr: ['c\n'] }));
  assert.deepStrictEqual(sections[0].lines.map((l) => l.text), ['a', 'b']);
  assert.deepStrictEqual(sections[1].lines.map((l) => l.text), ['c']);
});
