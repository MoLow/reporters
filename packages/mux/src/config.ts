import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MuxConfig } from './types.ts';

const CONFIG_NAMES = ['mux.config.js', 'mux.config.mjs', 'mux.config.ts'];

/**
 * Walk up from `startDir` to the filesystem root looking for a `mux.config.*`
 * file. This is the same upward search used by config loaders like `find-up`,
 * `cosmiconfig`, and ESLint's flat-config lookup — inlined here (≈10 lines)
 * so `@reporters/mux` stays dependency-free.
 */
export function findConfigFile(startDir: string = process.cwd()): string | undefined {
  let dir = startDir;
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export async function loadConfig(startDir: string = process.cwd()): Promise<MuxConfig> {
  const file = findConfigFile(startDir);
  if (!file) throw new Error(`mux: no mux.config.{js,mjs,ts} found (searched up from ${startDir})`);
  const mod = await import(pathToFileURL(file).href);
  return (mod.default ?? mod) as MuxConfig;
}
