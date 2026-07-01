import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, parseWireLines, type TreeStore } from '@reporters/tree-core';
import { TreeView } from './TreeView.tsx';

declare global {
  interface Window {
    __reportersRenderEmbedded?: () => void;
    __reportersRendered?: boolean;
  }
}

const SCROLL_KEY = 'reporters:scroll';
const SIG_KEY = 'reporters:sig';
const STALL_KEY = 'reporters:stall';
const POLL_MS = 1500;
// Give up after this many consecutive no-growth polls — a safety valve so a
// crashed/abandoned partial file doesn't reload forever. High enough to sit
// through a genuinely slow test that emits no events while it runs.
const MAX_STALL = 20;

function isComplete(store: TreeStore): boolean {
  const snap = store.getSnapshot();
  if (snap.summary) return true;
  const { counts } = snap;
  return counts.total > 0 && counts.running === 0 && counts.queued === 0;
}

function stopLiveRefresh(): void {
  sessionStorage.removeItem(SIG_KEY);
  sessionStorage.removeItem(STALL_KEY);
  sessionStorage.removeItem(SCROLL_KEY);
}

/**
 * The embedded report is a static file. When it's opened while a run is still
 * streaming into it, the browser can't see the newly appended bytes (and can't
 * fetch() a local file to re-read itself), so we reload until the run completes.
 * We keep reloading across quiet gaps between completions (the file doesn't grow
 * while a slow test runs), stopping only when complete or after a long stall.
 * The scroll position is preserved so the page doesn't jump on each reload.
 */
function scheduleLiveRefresh(text: string, complete: boolean): void {
  if (complete) { stopLiveRefresh(); return; }

  const signature = String(text.length);
  const grew = sessionStorage.getItem(SIG_KEY) !== signature;
  const stall = grew ? 0 : Number(sessionStorage.getItem(STALL_KEY) ?? '0') + 1;
  if (stall >= MAX_STALL) { stopLiveRefresh(); return; }

  sessionStorage.setItem(SIG_KEY, signature);
  sessionStorage.setItem(STALL_KEY, String(stall));
  window.setTimeout(() => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.location.reload();
  }, POLL_MS);
}

function render(): void {
  if (window.__reportersRendered) return;
  const events = document.getElementById('events');
  const mount = document.getElementById('root');
  if (!mount) return;

  const text = events?.textContent ?? '';
  const store = createTreeStore();
  for (const event of parseWireLines(text)) store.apply(event);
  window.__reportersRendered = true;

  const complete = isComplete(store);
  createRoot(mount).render(<TreeView snapshot={store.getSnapshot()} streaming={!complete} />);

  const saved = sessionStorage.getItem(SCROLL_KEY);
  if (saved) window.scrollTo(0, Number(saved));

  scheduleLiveRefresh(text, complete);
}

window.__reportersRenderEmbedded = render;
