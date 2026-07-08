import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, type TreeStore } from '@reporters/tree-core';
import { createNdjsonReader } from '../poll.ts';
import { resolveReportSource, type ViewerOptions as SourceOptions } from '../source.ts';
import { STYLES } from '../template.ts';
import { TreeView, type RenderNodeActions } from './TreeView.tsx';
import { initTooltips } from './tooltip.ts';

export type { ReportSource } from '../source.ts';
export type { FetchLike } from '../poll.ts';
export type { RenderNodeActions } from './TreeView.tsx';
export type { TestNode } from '@reporters/tree-core';

export interface ViewerOptions extends SourceOptions {
  /** Render custom trailing content (e.g. action buttons) at the end of every
   *  tree row, inside a `.node-actions` wrapper that swallows clicks/keys so
   *  they never toggle the row. Called for every node — containers and tests
   *  alike — on each render (frequent during a live run), so keep it cheap;
   *  return null to render nothing for a node. Visibility (e.g. reveal on row
   *  hover) is the embedder's own CSS: `.row:hover .node-actions { … }`. */
  renderNodeActions?: RenderNodeActions;
}

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
      renderNodeActions={options.renderNodeActions}
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
