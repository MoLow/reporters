import { test } from 'node:test';
import assert from 'node:assert';
import { soleFileDestination, isCI, shouldOpen, openCommand } from '../src/open.ts';

test('soleFileDestination reads --test-reporter-destination from execArgv', () => {
  assert.strictEqual(soleFileDestination(['--test-reporter-destination=report.ndjson']), 'report.ndjson');
  assert.strictEqual(soleFileDestination(['--test-reporter-destination', 'out.ndjson']), 'out.ndjson');
  // stream destinations are ignored; a lone real file still wins
  assert.strictEqual(soleFileDestination(['--test-reporter-destination', 'stdout', '--test-reporter-destination=r.ndjson']), 'r.ndjson');
  // ambiguous (two files) or none => undefined (e.g. driven through mux)
  assert.strictEqual(soleFileDestination(['--test-reporter-destination=a', '--test-reporter-destination=b']), undefined);
  assert.strictEqual(soleFileDestination(['--test']), undefined);
});

test('isCI detects common CI environments', () => {
  assert.strictEqual(isCI({}), false);
  assert.strictEqual(isCI({ CI: 'true' }), true);
  assert.strictEqual(isCI({ GITHUB_ACTIONS: 'true' }), true);
});

test('shouldOpen: explicit option wins, then env, then TTY (off in CI)', () => {
  // explicit option beats everything
  assert.strictEqual(shouldOpen(true, { CI: 'true' }, false), true);
  assert.strictEqual(shouldOpen(false, {}, true), false);
  // env override when no option
  assert.strictEqual(shouldOpen(undefined, { REPORTERS_WEB_OPEN: '1' }, false), true);
  assert.strictEqual(shouldOpen(undefined, { REPORTERS_WEB_OPEN: '0' }, true), false);
  // default: on for a TTY, off without one and off in CI
  assert.strictEqual(shouldOpen(undefined, {}, true), true);
  assert.strictEqual(shouldOpen(undefined, {}, false), false);
  assert.strictEqual(shouldOpen(undefined, { CI: 'true' }, true), false);
});

test('openCommand is platform-specific', () => {
  assert.deepStrictEqual(openCommand('u', 'darwin'), ['open', ['u']]);
  assert.deepStrictEqual(openCommand('u', 'linux'), ['xdg-open', ['u']]);
  assert.deepStrictEqual(openCommand('u', 'win32'), ['cmd', ['/c', 'start', '', 'u']]);
});
