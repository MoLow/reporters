import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, type TreeStore } from '@reporters/tree-core';
import { createNdjsonReader } from '../poll.ts';
import { resolveReportSource, type ViewerOptions } from '../source.ts';
import { STYLES } from '../template.ts';
import { TreeView } from './TreeView.tsx';
import { initTooltips } from './tooltip.ts';

export type { ReportSource, ViewerOptions } from '../source.ts';
export type { FetchLike } from '../poll.ts';

const delay = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

function injectStyles(): void {
  if (document.getElementById('reporters-styles')) return;
  const style = document.createElement('style');
  style.id = 'reporters-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export async function startViewer(options: ViewerOptions = {}): Promise<void> {
  injectStyles();
  initTooltips();
  const mount = document.getElementById('root');
  if (!mount) return;
  const root = createRoot(mount);

  let store: TreeStore = createTreeStore();
  let streaming = true;
  let pending = true;
  let loadError = false;
  const retry = () => window.location.reload();
  const draw = () => root.render(
    <TreeView
      snapshot={store.getSnapshot()}
      streaming={streaming}
      pending={pending}
      loadError={loadError}
      onRetry={retry}
    />,
  );

  let source;
  try {
    source = await resolveReportSource(new URLSearchParams(window.location.search), options);
  } catch (err) {
    console.error(err);
    source = null;
  }
  if (!source) {
    streaming = false;
    loadError = true;
    draw();
    return;
  }

  const reader = createNdjsonReader(source.url, source.fetch);
  draw();

  // Poll until the run reports a final summary, then stop.
  for (;;) {
    try {
      const { events, reset } = await reader.pull();
      const firstCheck = pending;
      pending = false;
      if (reset) store = createTreeStore();
      for (const event of events) store.apply(event);
      loadError = false;
      if (store.getSnapshot().summary) { streaming = false; draw(); break; }
      if (events.length || reset || firstCheck) draw();
    } catch (err) {
      // Never received any data yet: the source is missing/unreachable — surface
      // the error screen. Once data has arrived, treat failures as transient.
      if (store.getSnapshot().root.children.length === 0) { pending = false; loadError = true; draw(); }
      console.error(err);
    }
    await delay(source.pollMs);
  }
}
