import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../dist/start.js', import.meta.url), 'utf8');

test('the viewer library bundle is a non-empty file', () => {
  assert.ok(bundle.length > 0);
});

test('the viewer library bundle exports startViewer', () => {
  assert.match(bundle, /export\s*\{[^}]*\bas\s+startViewer\b[^}]*\}/);
});

test('the viewer library bundle has no bare static imports', () => {
  assert.doesNotMatch(bundle, /from\s*["'][^./]/);
});

test('the viewer library bundle ships production React', () => {
  assert.doesNotMatch(bundle, /react\.development/);
});
