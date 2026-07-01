import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, type TreeStore } from '@reporters/tree-core';
import { createNdjsonReader } from '../poll.ts';
import { STYLES } from '../template.ts';
import { TreeView } from './TreeView.tsx';

const POLL_MS = 1000;
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

  const src = new URLSearchParams(window.location.search).get('src');
  if (!src) {
    mount.innerHTML = '<div class="empty">Add <code>?src=&lt;url-to-your-run.ndjson&gt;</code> to view a report.</div>';
    return;
  }

  let store: TreeStore = createTreeStore();
  const reader = createNdjsonReader(src);
  const draw = () => root.render(<TreeView snapshot={store.getSnapshot()} />);
  draw();

  // Poll until the run reports a final summary, then stop.
  for (;;) {
    try {
      const { events, reset } = await reader.pull();
      if (reset) store = createTreeStore();
      for (const event of events) store.apply(event);
      if (events.length || reset) draw();
      if (store.getSnapshot().summary) { draw(); break; }
    } catch (err) {
      // Transient fetch/CORS error: keep trying.
      console.error(err);
    }
    await delay(POLL_MS);
  }
}

main();
