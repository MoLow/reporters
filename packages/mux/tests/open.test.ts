import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shouldOpen, openCommand, announce } from '../src/open.ts';

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

function captureStderr(fn: () => void): string {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = ((chunk: string | Buffer) => { captured += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

test('announce prints a stderr hint with the viewer url', () => {
  const out = captureStderr(() => announce('https://v.example/?src=x', {}));
  assert.match(out, /@reporters\/mux: report at https:\/\/v\.example\/\?src=x/);
});

test('announce appends a View report link to the GitHub step summary', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mux-announce-'));
  const summary = join(dir, 'summary.md');
  captureStderr(() => announce('https://v.example/?src=x', { GITHUB_STEP_SUMMARY: summary }));
  assert.match(readFileSync(summary, 'utf8'), /\[View report\]\(https:\/\/v\.example\/\?src=x\)/);
  rmSync(dir, { recursive: true, force: true });
});

test('announce ignores an unwritable step summary (the stderr hint already landed)', () => {
  const out = captureStderr(() => announce('https://v.example/?src=x', { GITHUB_STEP_SUMMARY: '/nonexistent-dir/summary.md' }));
  assert.match(out, /report at/);
});
