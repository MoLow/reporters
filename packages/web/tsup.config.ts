import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig([
  // The node reporter and HTTP sink. Bundles tree-core; reads the viewer client at runtime.
  {
    entry: { index: 'src/index.ts', sink: 'src/sink.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    dts: true,
    clean: false,
    noExternal: [/@reporters\/tree-core/],
  },
  // Browser clients: self-contained IIFE bundles (React + react-dom + tree-core
  // inlined). `viewer` is assembled into a standalone page below.
  {
    entry: { viewer: 'src/client/viewer.tsx' },
    format: ['iife'],
    platform: 'browser',
    target: 'es2020',
    dts: false,
    clean: false,
    minify: true,
    async onSuccess() {
      const viewerJs = readFileSync('dist/viewer.global.js', 'utf8');
      const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>node:test viewer</title>
</head>
<body>
<div id="root"></div>
<script>${viewerJs}</script>
</body>
</html>
`;
      mkdirSync('dist/viewer', { recursive: true });
      writeFileSync('dist/viewer/index.html', page);
    },
  },
]);
