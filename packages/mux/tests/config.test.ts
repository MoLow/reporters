import { test } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findConfigFile, loadConfig } from '../src/config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const proj = join(here, 'fixtures', 'proj');

test('findConfigFile locates a config by walking up from a start dir', () => {
  const nested = join(proj, 'a', 'b');
  assert.strictEqual(findConfigFile(nested), join(proj, 'mux.config.mjs'));
});

test('findConfigFile returns undefined when none exists', () => {
  assert.strictEqual(findConfigFile('/'), undefined);
});

test('loadConfig imports the default export', async () => {
  const config = await loadConfig(proj);
  assert.deepStrictEqual(Object.keys(config), ['local']);
  assert.strictEqual(config.local[0].sink, 'stdout');
});

test('loadConfig throws when no config is found', async () => {
  await assert.rejects(() => loadConfig('/'), /no mux\.config/);
});

test('loadConfig falls back to the module namespace when there is no default export', async () => {
  const config = await loadConfig(join(here, 'fixtures', 'proj-nodefault'));
  assert.ok(Array.isArray(config.local));
});
