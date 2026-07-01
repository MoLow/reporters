import { test } from 'node:test';
import assert from 'node:assert';
import { shouldOpen, openCommand } from '../src/open.ts';

test('shouldOpen: on locally, off in CI, route can opt out, env forces', () => {
  assert.strictEqual(shouldOpen(undefined, {}), true);
  assert.strictEqual(shouldOpen(undefined, { CI: 'true' }), false);
  assert.strictEqual(shouldOpen(false, {}), false);
  assert.strictEqual(shouldOpen(undefined, { REPORTERS_OPEN: '0' }), false);
  assert.strictEqual(shouldOpen(false, { REPORTERS_OPEN: '1' }), true);
  assert.strictEqual(shouldOpen(undefined, { CI: 'true', REPORTERS_OPEN: '1' }), true);
});

test('openCommand is platform-specific', () => {
  assert.deepStrictEqual(openCommand('u', 'darwin'), ['open', ['u']]);
  assert.deepStrictEqual(openCommand('u', 'linux'), ['xdg-open', ['u']]);
  assert.deepStrictEqual(openCommand('u', 'win32'), ['cmd', ['/c', 'start', '', 'u']]);
});
