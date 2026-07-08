import { test } from 'node:test';
import assert from 'node:assert';
import { inspect } from 'node:util';
import { formatDuration } from '../src/format.ts';
import { toWireEvent, serializeWireLine, parseWireLines } from '../src/wire.ts';
import { defaultExpanded } from '../src/expand.ts';
import * as api from '../src/index.ts';
import type { TestNode } from '../src/types.ts';

test('the package entrypoint re-exports the public API and theme tokens', () => {
  assert.strictEqual(typeof api.createTreeStore, 'function');
  assert.strictEqual(typeof api.formatDuration, 'function');
  assert.strictEqual(typeof api.toWireEvent, 'function');
  assert.strictEqual(typeof api.parseWireLines, 'function');
  assert.strictEqual(typeof api.serializeWireLine, 'function');
  assert.strictEqual(typeof api.defaultExpanded, 'function');
  assert.strictEqual(api.SYMBOLS.passed, '✔');
  assert.ok(api.SPINNER_FRAMES.length > 0);
  assert.ok(api.INK_COLOR.failed && api.WEB_COLOR.failed);
  assert.ok(api.STATUS_LABEL.passed && api.TREE_GUIDES.vertical);
});

test('formatDuration renders ms, seconds and minutes', () => {
  assert.strictEqual(formatDuration(0), '0ms');
  assert.strictEqual(formatDuration(5), '5ms');
  assert.strictEqual(formatDuration(999), '999ms');
  assert.strictEqual(formatDuration(1000), '1s');
  assert.strictEqual(formatDuration(1500), '1.5s');
  assert.strictEqual(formatDuration(65000), '1m 5s');
  assert.strictEqual(formatDuration(3600000), '1h 0m');
  assert.strictEqual(formatDuration(3600000 + 125000), '1h 2m');
  assert.strictEqual(formatDuration(9000000), '2h 30m');
  assert.strictEqual(formatDuration(undefined), '');
});

test('formatDuration carries boundary rounding into the next unit', () => {
  assert.strictEqual(formatDuration(59949), '59.9s');
  assert.strictEqual(formatDuration(59950), '1m 0s'); // rounds to 60s → carried
  assert.strictEqual(formatDuration(119700), '2m 0s'); // not "1m 60s"
  assert.strictEqual(formatDuration(3599500), '1h 0m'); // not "59m 60s"
  assert.strictEqual(formatDuration(7170000), '2h 0m'); // not "1h 60m"
});

test('toWireEvent keeps only known fields and is JSON-safe', () => {
  const wire = toWireEvent({
    type: 'test:pass',
    // @ts-expect-error extraneous field should be dropped
    data: {
      name: 't', nesting: 0, file: '/f.js', testId: 1, junk: 'drop', details: { duration_ms: 5, error: new Error('boom') },
    },
  });
  assert.strictEqual(wire.type, 'test:pass');
  assert.strictEqual(wire.data.name, 't');
  assert.ok(!('junk' in wire.data));
  // The error has been flattened into a JSON-serializable shape.
  assert.doesNotThrow(() => JSON.stringify(wire));
  const reparsed = JSON.parse(JSON.stringify(wire));
  assert.strictEqual(reparsed.data.details.error.message, 'boom');
});

test('serializeWireLine produces one parseable JSON line per event', () => {
  const line = serializeWireLine({ type: 'test:pass', data: { name: 't', testId: 1, nesting: 0 } });
  assert.ok(line.endsWith('\n'));
  assert.strictEqual(JSON.parse(line).type, 'test:pass');
});

test('serializeWireLine stamps the event with the writer wall-clock', () => {
  const before = Date.now();
  const line = serializeWireLine({ type: 'test:pass', data: { name: 't', testId: 1, nesting: 0 } });
  const after = Date.now();
  const { t } = JSON.parse(line);
  assert.strictEqual(typeof t, 'number');
  assert.ok(t >= before && t <= after);
});

test('a pre-stamped event keeps its own clock through the wire', () => {
  const line = serializeWireLine({ type: 'test:pass', t: 12345, data: { name: 't', testId: 1, nesting: 0 } });
  assert.strictEqual(JSON.parse(line).t, 12345);
  assert.strictEqual(toWireEvent({ type: 'test:pass', t: 777, data: {} }).t, 777);
});

test('an explicit undefined t still gets a fresh stamp', () => {
  const line = serializeWireLine({ type: 'test:pass', t: undefined, data: { name: 't', testId: 1, nesting: 0 } });
  assert.strictEqual(typeof JSON.parse(line).t, 'number');
});

test('parseWireLines parses NDJSON and skips blank or truncated lines', () => {
  const text = [
    '{"type":"test:start","data":{"name":"a"}}',
    '',
    '   ',
    '{"type":"test:pass","data":{"name":"a"}}',
    '{"type":"test:fail","data":{"name":"b"', // truncated trailing line
  ].join('\n');
  const events = parseWireLines(text);
  assert.deepStrictEqual(events.map((e) => e.type), ['test:start', 'test:pass']);
});

test('toWireEvent copies every known field and flattens nested errors', () => {
  const cause = new Error('root cause');
  const wrapper = Object.assign(new Error('wrapper'), { cause });
  const wire = toWireEvent({
    type: 'test:fail',
    data: {
      name: 't',
      nesting: 2,
      file: '/a.test.js',
      testId: 7,
      parentId: 3,
      line: 10,
      column: 4,
      tags: ['slow'],
      todo: 'later',
      skip: false,
      message: 'msg',
      level: 'warn',
      count: 5,
      type: 'suite',
      counts: { tests: 1 },
      duration_ms: 12,
      success: false,
      details: { duration_ms: 12, type: 'suite', passed: false, error: wrapper },
    },
  });
  const d = wire.data;
  assert.deepStrictEqual(
    [d.name, d.nesting, d.file, d.testId, d.parentId, d.line, d.column],
    ['t', 2, '/a.test.js', 7, 3, 10, 4],
  );
  assert.deepStrictEqual([d.tags, d.todo, d.skip, d.message, d.level, d.count], [['slow'], 'later', false, 'msg', 'warn', 5]);
  assert.deepStrictEqual([d.type, d.counts, d.duration_ms, d.success], ['suite', { tests: 1 }, 12, false]);
  assert.strictEqual(d.details?.type, 'suite');
  const err = d.details?.error as { message: string; cause: { message: string } };
  assert.strictEqual(err.message, 'wrapper');
  assert.strictEqual(err.cause.message, 'root cause');
});

test('toWireEvent appends extra enumerable error props to the stack, inspect-style', () => {
  const error = Object.assign(new Error('job stuck'), {
    jobId: '456707be',
    temporal: 'https://temporal.example/wf/456707be',
    attempts: 3,
    pendingActivities: ['UpdateEvidenceTable'],
    meta: { httpStatusCode: 400, nested: { deep: { too: 1 } } },
  });
  const wire = toWireEvent({ type: 'test:fail', data: { details: { duration_ms: 1, error } } });
  const flat = wire.data.details?.error as { message: string; stack: string };
  assert.strictEqual(flat.message, 'job stuck');
  const suffix = flat.stack.slice(error.stack!.length);
  assert.strictEqual(suffix, [
    ' {',
    "  jobId: '456707be',",
    "  temporal: 'https://temporal.example/wf/456707be',",
    '  attempts: 3,',
    "  pendingActivities: [ 'UpdateEvidenceTable' ],",
    '  meta: { httpStatusCode: 400, nested: { deep: [Object] } }',
    '}',
  ].join('\n'));
  assert.strictEqual(flat.stack, inspect(error));
});

test('toWireEvent leaves the stack alone when the error has no extra props', () => {
  const error = new Error('plain');
  const wire = toWireEvent({ type: 'test:fail', data: { details: { duration_ms: 1, error } } });
  assert.strictEqual((wire.data.details?.error as { stack: string }).stack, error.stack);
});

test('toWireEvent appends cause props to the cause stack but skips the test-runner wrapper', () => {
  const cause = Object.assign(new Error('real'), { jobId: 'abc' });
  const wrapper = Object.assign(new Error('wrapped'), {
    code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure', exitCode: 1, cause,
  });
  const wire = toWireEvent({ type: 'test:fail', data: { details: { duration_ms: 1, error: wrapper } } });
  const flat = wire.data.details?.error as { stack: string; cause: { stack: string } };
  assert.ok(!flat.stack.includes('failureType'));
  assert.ok(flat.cause.stack.endsWith(" {\n  jobId: 'abc'\n}"));
});

test('re-flattening an already-flattened error does not duplicate the props block', () => {
  const error = Object.assign(new Error('boom'), { jobId: 'abc' });
  const once = toWireEvent({ type: 'test:fail', data: { details: { duration_ms: 1, error } } });
  const twice = toWireEvent(once);
  const a = once.data.details?.error as { stack: string };
  const b = twice.data.details?.error as { stack: string };
  assert.strictEqual(b.stack, a.stack);
});

test('extra error props survive odd values without breaking JSON serialization', () => {
  const error = Object.assign(new Error('boom'), {
    when: new Date(0),
    big: 10n,
    fn: () => {},
    none: null,
    quote: "it's",
    multi: 'a\nb',
  });
  (error as { self?: unknown }).self = error;
  const wire = toWireEvent({ type: 'test:fail', data: { details: { duration_ms: 1, error } } });
  assert.doesNotThrow(() => JSON.stringify(wire));
  const { stack } = wire.data.details?.error as { stack: string };
  assert.ok(stack.includes('when: 1970-01-01T00:00:00.000Z'));
  assert.ok(stack.includes('big: 10n'));
  assert.ok(stack.includes('fn: [Function: fn]'));
  assert.ok(stack.includes('none: null'));
  assert.ok(stack.includes(`quote: "it's"`));
  assert.ok(stack.includes("multi: 'a\\nb'"));
  assert.ok(stack.includes('self: [Circular *1]'));
});

test('toWireEvent tolerates a non-Error error value and a missing error', () => {
  const withString = toWireEvent({ type: 'test:fail', data: { details: { error: 'boom' as unknown as Error } } });
  assert.strictEqual((withString.data.details?.error as { message: string }).message, 'boom');
  const noError = toWireEvent({ type: 'test:pass', data: { details: { duration_ms: 1 } } });
  assert.strictEqual(noError.data.details?.error, undefined);
  // an event with no data object at all
  const noData = toWireEvent({ type: 'test:watch:drained' } as unknown as Parameters<typeof toWireEvent>[0]);
  assert.deepStrictEqual(noData.data, {});
});

test('toWireEvent + parseWireLines round-trips an event', () => {
  const [event] = parseWireLines(serializeWireLine(toWireEvent({
    type: 'test:fail',
    data: { name: 't', testId: 2, nesting: 1, details: { duration_ms: 4, error: new Error('boom') } },
  })));
  assert.strictEqual(event.type, 'test:fail');
  assert.strictEqual(event.data.testId, 2);
  assert.strictEqual((event.data.details?.error as { message: string }).message, 'boom');
});

function node(partial: Partial<TestNode>): TestNode {
  return {
    key: 'k',
    testId: 1,
    parentKey: null,
    file: undefined,
    name: 'n',
    nesting: 0,
    type: 'suite',
    status: 'passed',
    diagnostics: [],
    stdout: [],
    stderr: [],
    children: [],
    counts: {
      passed: 0, failed: 0, skipped: 0, todo: 0, running: 0, queued: 0, carried: 0, total: 0,
    },
    ...partial,
  };
}

test('isPassingTodo flags only a passed leaf still carrying the todo directive', () => {
  assert.strictEqual(api.isPassingTodo(node({ type: 'test', status: 'passed', todo: true, children: [] })), true);
  assert.strictEqual(api.isPassingTodo(node({ type: 'test', status: 'passed', todo: 'why', children: [] })), true);
  assert.strictEqual(api.isPassingTodo(node({ type: 'test', status: 'passed', children: [] })), false);
  assert.strictEqual(api.isPassingTodo(node({ type: 'test', status: 'todo', todo: true, children: [] })), false);
  assert.strictEqual(api.isPassingTodo(node({ type: 'suite', status: 'passed', todo: true, children: [node({ type: 'test' })] })), false);
});

test('todoLabel mirrors the spec reporter directive text', () => {
  assert.strictEqual(api.todoLabel(node({ type: 'test', todo: true, children: [] })), 'TODO');
  assert.strictEqual(api.todoLabel(node({ type: 'test', todo: 'flaky backend', children: [] })), 'flaky backend');
  assert.strictEqual(api.todoLabel(node({ type: 'test', todo: '', children: [] })), 'TODO');
  assert.strictEqual(api.todoLabel(node({ type: 'test', children: [] })), undefined);
  assert.strictEqual(api.todoLabel(node({ type: 'test', todo: false, children: [] })), undefined);
});

test('defaultExpanded keeps every container expanded and leaves collapsed', () => {
  const kids = [node({ type: 'test' })];
  assert.strictEqual(defaultExpanded(node({ type: 'file', children: kids })), true);
  // passed suites stay expanded too — the tree does not auto-collapse
  assert.strictEqual(defaultExpanded(node({ type: 'suite', status: 'passed', children: kids })), true);
  assert.strictEqual(defaultExpanded(node({ type: 'suite', status: 'failed', children: kids })), true);
  // a childless leaf has nothing to expand
  assert.strictEqual(defaultExpanded(node({ type: 'test', status: 'failed' })), false);
});
