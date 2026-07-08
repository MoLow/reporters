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

test('the viewer library bundle imports only react as a bare specifier', () => {
  const bare = [...bundle.matchAll(/from\s*["']([^./"'][^"']*)["']/g)].map((m) => m[1]);
  assert.ok(bare.some((spec) => /^react(\/|$)/.test(spec)));
  for (const spec of bare) assert.match(spec, /^react(-dom)?(\/|$)/);
});

test('the standalone viewer page still inlines React', () => {
  const page = readFileSync(new URL('../dist/viewer/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /from\s*["']react["']/);
  assert.doesNotMatch(page, /require\(\s*["']react["']\s*\)/);
});
