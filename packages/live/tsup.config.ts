import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
  noExternal: [/@reporters\/tree-core/],
});
