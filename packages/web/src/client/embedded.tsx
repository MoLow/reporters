import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, parseWireLines } from '@reporters/tree-core';
import { TreeView } from './TreeView.tsx';

declare global {
  interface Window {
    __reportersRenderEmbedded?: () => void;
    __reportersRendered?: boolean;
  }
}

function render(): void {
  if (window.__reportersRendered) return;
  const events = document.getElementById('events');
  const mount = document.getElementById('root');
  if (!mount) return;
  const store = createTreeStore();
  for (const event of parseWireLines(events?.textContent ?? '')) store.apply(event);
  window.__reportersRendered = true;
  createRoot(mount).render(<TreeView snapshot={store.getSnapshot()} />);
}

window.__reportersRenderEmbedded = render;
