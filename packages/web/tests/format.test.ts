import { test } from 'node:test';
import assert from 'node:assert';
import {
  classifyFrame, classifyStack, extractLevel, levelSeverity, splitUrls, stripAnsi,
} from '../src/client/format.ts';

test('stripAnsi removes SGR codes', () => {
  assert.strictEqual(stripAnsi('[32mINFO[39m: hi'), 'INFO: hi');
});

test('extractLevel: pino-style timestamped prefix with ANSI', () => {
  assert.strictEqual(extractLevel('[12:44:42.549] [31mERROR[39m: Cached operation failed'), 'error');
  assert.strictEqual(extractLevel('[12:44:42.550] [33mWARN[39m: Error during caching'), 'warn');
  assert.strictEqual(extractLevel('[12:44:42.778] [32mINFO[39m: [36mTest context initialized[39m'), 'info');
});

test('extractLevel: bare level prefix', () => {
  assert.strictEqual(extractLevel('WARNING: disk almost full'), 'warning');
  assert.strictEqual(extractLevel('debug: verbose detail'), 'debug');
});

test('extractLevel: non-matching free text returns null', () => {
  assert.strictEqual(extractLevel('tests 4'), null);
  assert.strictEqual(extractLevel('duration_ms 2.5'), null);
  assert.strictEqual(extractLevel('the error: was handled'), null);
});

test('classifyStack: head, user frame with location split, internal frames', () => {
  const stack = [
    'Error: Test not implemented',
    '    at TestContext.<anonymous> (/Users/me/repos/app/a.test.js:4:11)',
    '    at Test.runInAsyncScope (node:async_hooks:226:14)',
    '    at Test.run (node:internal/test_runner/test:1382:25)',
    '    at fn (/repo/node_modules/lib/index.js:1:1)',
  ].join('\n');
  const lines = classifyStack(stack);
  assert.strictEqual(lines[0].kind, 'head');
  assert.strictEqual(lines[1].kind, 'frame');
  assert.deepStrictEqual(lines[1].loc, {
    pre: '    at TestContext.<anonymous> (',
    location: '/Users/me/repos/app/a.test.js:4:11',
    post: ')',
  });
  assert.strictEqual(lines[2].kind, 'internal');
  assert.strictEqual(lines[3].kind, 'internal');
  assert.strictEqual(lines[4].kind, 'internal');
});

test('classifyStack: file:// URLs in frames are located', () => {
  const lines = classifyStack('    at failOnce (file:///runner/_work/app/t.test.ts:52:15)');
  assert.strictEqual(lines[0].kind, 'frame');
  assert.strictEqual(lines[0].loc?.location, 'file:///runner/_work/app/t.test.ts:52:15');
});

test('classifyStack: frame without parseable location stays plain', () => {
  const lines = classifyStack('    at <anonymous>');
  assert.strictEqual(lines[0].kind, 'frame');
  assert.strictEqual(lines[0].loc, undefined);
});

test('classifyFrame: frame lines inside log text are classified, others null', () => {
  assert.strictEqual(classifyFrame('cacheKey: "256965e5"'), null);
  assert.strictEqual(classifyFrame('Error: Simulated 504'), null);
  const internal = classifyFrame('        at Test.run (node:internal/test_runner/test:1382:25)');
  assert.strictEqual(internal?.kind, 'internal');
  const user = classifyFrame('        at failOnce (file:///runner/t.test.ts:52:15)');
  assert.strictEqual(user?.kind, 'frame');
  assert.strictEqual(user?.loc?.location, 'file:///runner/t.test.ts:52:15');
});

test('classifyFrame: strips ANSI before matching', () => {
  const frame = classifyFrame('    at f (\u001b[36m/repo/a.ts:1:2\u001b[39m)');
  assert.strictEqual(frame?.kind, 'frame');
  assert.strictEqual(frame?.loc?.location, '/repo/a.ts:1:2');
});

test('splitUrls: extracts http(s) URLs, keeps surrounding text', () => {
  assert.deepStrictEqual(splitUrls('logs: "https://app.example.com/logs?a=%22b%22&c=1" done'), [
    { kind: 'text', text: 'logs: "' },
    { kind: 'url', text: 'https://app.example.com/logs?a=%22b%22&c=1' },
    { kind: 'text', text: '" done' },
  ]);
});

test('splitUrls: no URLs yields single text segment', () => {
  assert.deepStrictEqual(splitUrls('plain text'), [{ kind: 'text', text: 'plain text' }]);
});

test('splitUrls: URL at start and end, multiple URLs', () => {
  assert.deepStrictEqual(splitUrls('https://a.io and http://b.io'), [
    { kind: 'url', text: 'https://a.io' },
    { kind: 'text', text: ' and ' },
    { kind: 'url', text: 'http://b.io' },
  ]);
});

test('splitUrls: does not swallow closing quotes/brackets', () => {
  const [seg] = splitUrls('https://a.io/x)');
  assert.deepStrictEqual(seg, { kind: 'url', text: 'https://a.io/x' });
});

test('levelSeverity maps levels to status tints', () => {
  assert.strictEqual(levelSeverity('error'), 'failed');
  assert.strictEqual(levelSeverity('fatal'), 'failed');
  assert.strictEqual(levelSeverity('warn'), 'running');
  assert.strictEqual(levelSeverity('warning'), 'running');
  assert.strictEqual(levelSeverity('info'), 'skipped');
  assert.strictEqual(levelSeverity('debug'), 'skipped');
});
