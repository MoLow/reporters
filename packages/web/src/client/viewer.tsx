import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, type TreeStore } from '@reporters/tree-core';
import { createNdjsonReader, resolvePollMs } from '../poll.ts';
import { STYLES } from '../template.ts';
import { TreeView } from './TreeView.tsx';

const delay = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

function injectStyles(): void {
  if (document.getElementById('reporters-styles')) return;
  const style = document.createElement('style');
  style.id = 'reporters-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

async function main(): Promise<void> {
  injectStyles();
  const mount = document.getElementById('root');
  if (!mount) return;
  const root = createRoot(mount);

  let store: TreeStore = createTreeStore();
  let streaming = true;
  let loadError = false;
  const retry = () => window.location.reload();
  const draw = () => root.render(
    <TreeView snapshot={store.getSnapshot()} streaming={streaming} loadError={loadError} onRetry={retry} />,
  );

  const params = new URLSearchParams(window.location.search);
  const src = params.get('src');
  const pollMs = resolvePollMs(params.get('poll'));
  if (!src) {
    streaming = false;
    loadError = true;
    draw();
    return;
  }

  const reader = createNdjsonReader(src);
  draw();

  // Poll until the run reports a final summary, then stop.
  for (;;) {
    try {
      const { events, reset } = await reader.pull();
      if (reset) store = createTreeStore();
      for (const event of events) store.apply(event);
      loadError = false;
      if (store.getSnapshot().summary) { streaming = false; draw(); break; }
      if (events.length || reset) draw();
    } catch (err) {
      // Never received any data yet: the source is missing/unreachable — surface
      // the error screen. Once data has arrived, treat failures as transient.
      if (store.getSnapshot().root.children.length === 0) { loadError = true; draw(); }
      console.error(err);
    }
    await delay(pollMs);
  }
}

main();
