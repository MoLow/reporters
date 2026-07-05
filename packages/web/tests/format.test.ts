import { test } from 'node:test';
import assert from 'node:assert';
import { extractLevel, levelSeverity, stripAnsi } from '../src/client/format.ts';

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

test('levelSeverity maps levels to status tints', () => {
  assert.strictEqual(levelSeverity('error'), 'failed');
  assert.strictEqual(levelSeverity('fatal'), 'failed');
  assert.strictEqual(levelSeverity('warn'), 'running');
  assert.strictEqual(levelSeverity('warning'), 'running');
  assert.strictEqual(levelSeverity('info'), 'skipped');
  assert.strictEqual(levelSeverity('debug'), 'skipped');
});
