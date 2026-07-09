import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, type TreeSnapshot } from '@reporters/tree-core';
import { createNdjsonReader, DEFAULT_POLL_MS, type FetchLike } from '../poll.ts';
import { resolveReportSource, type ViewerOptions as SourceOptions } from '../source.ts';
import { STYLES } from '../template.ts';
import { TreeView, type RenderHeaderActions, type RenderNodeActions } from './TreeView.tsx';
import { initTooltips } from './tooltip.ts';
import type { FilterStore } from './urlState.ts';

export type { ReportSource } from '../source.ts';
export type { FetchLike } from '../poll.ts';
export type { RenderHeaderActions, RenderNodeActions } from './TreeView.tsx';
export type { TestNode } from '@reporters/tree-core';
export { memoryFilterState, urlFilterState, type FilterState, type FilterStore } from './urlState.ts';

export interface ViewerOptions extends SourceOptions {
  /** Render custom trailing content (e.g. action buttons) at the end of every
   *  tree row, inside a `.node-actions` wrapper that swallows clicks/keys so
   *  they never toggle the row. Called for every node — containers and tests
   *  alike — on each render (frequent during a live run), so keep it cheap;
   *  return null to render nothing for a node. Visibility (e.g. reveal on row
   *  hover) is the embedder's own CSS: `.row:hover .node-actions { … }`. */
  renderNodeActions?: RenderNodeActions;
  /** Render custom content in the header toolbar, to the right of the built-in
   *  buttons (search, theme, collapse all), inside a `.header-actions` wrapper.
   *  Called on each render (frequent during a live run), so keep it cheap. */
  renderHeaderActions?: RenderHeaderActions;
}

const delay = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

function injectStyles(): void {
  if (document.getElementById('reporters-styles')) return;
  const style = document.createElement('style');
  style.id = 'reporters-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

interface StreamView {
  snapshot: TreeSnapshot;
  streaming: boolean;
  pending: boolean;
  loadError: boolean;
}

/** Poll the NDJSON report and fold events into a live snapshot. Stops at the
 *  run's final summary, on unmount, or when the source identity changes;
 *  `retry` restarts the stream from scratch after a load error. */
function useReportStream(src: string, fetchImpl: FetchLike | undefined, pollMs: number) {
  const [generation, setGeneration] = useState(0);
  const [view, setView] = useState<StreamView>(() => ({
    snapshot: createTreeStore().getSnapshot(), streaming: true, pending: true, loadError: false,
  }));
  useEffect(() => {
    let cancelled = false;
    let store = createTreeStore();
    const reader = createNdjsonReader(src, fetchImpl);
    setView({
      snapshot: store.getSnapshot(), streaming: true, pending: true, loadError: false,
    });
    (async () => {
      // Poll until the run reports a final summary, then stop.
      for (;;) {
        try {
          const { events, reset } = await reader.pull();
          if (cancelled) return;
          if (reset) store = createTreeStore();
          for (const event of events) store.apply(event);
          const snapshot = store.getSnapshot();
          if (snapshot.summary) {
            setView({
              snapshot, streaming: false, pending: false, loadError: false,
            });
            return;
          }
          setView((prev) => (events.length || reset || prev.pending || prev.loadError ? {
            snapshot, streaming: true, pending: false, loadError: false,
          } : prev));
        } catch (err) {
          // Never received any data yet: the source is missing/unreachable —
          // surface the error screen. Once data has arrived, treat failures as
          // transient and keep polling.
          console.error(err);
          if (cancelled) return;
          setView((prev) => (prev.snapshot.root.children.length === 0 ? {
            ...prev, pending: false, loadError: true,
          } : prev));
        }
        await delay(pollMs);
        if (cancelled) return;
      }
    })();
    return () => { cancelled = true; };
  }, [src, fetchImpl, pollMs, generation]);
  const retry = useCallback(() => setGeneration((g) => g + 1), []);
  return { ...view, retry };
}

export interface TestReportViewerProps {
  /** URL of the NDJSON report; polled with HTTP Range while the run streams. */
  src: string;
  /** Transport for reads; defaults to the global fetch. Receives the reader's
   *  Range header and must return a standard Response. */
  fetch?: FetchLike;
  /** Poll cadence while the run is live. */
  pollMs?: number;
  renderNodeActions?: RenderNodeActions;
  renderHeaderActions?: RenderHeaderActions;
  /** Where filter state (?q, ?status, ?rerun) lives; defaults to the
   *  shareable page URL. Pass memoryFilterState() when the host app owns the
   *  address bar, or your own store to bind filters to a router or state
   *  container. Must be stable across renders. */
  filters?: FilterStore;
}

/** The report viewer as a React component: render it anywhere in a host app.
 *  Polls `src`, live-updates until the run's summary, and stops polling on
 *  unmount. Styles are injected into document.head on first mount. */
export function TestReportViewer({
  src, fetch: fetchImpl, pollMs = DEFAULT_POLL_MS, renderNodeActions, renderHeaderActions, filters,
}: TestReportViewerProps) {
  useEffect(() => { injectStyles(); initTooltips(); }, []);
  const {
    snapshot, streaming, pending, loadError, retry,
  } = useReportStream(src, fetchImpl, pollMs);
  return (
    <TreeView
      snapshot={snapshot}
      streaming={streaming}
      pending={pending}
      loadError={loadError}
      onRetry={retry}
      renderNodeActions={renderNodeActions}
      renderHeaderActions={renderHeaderActions}
      filters={filters}
    />
  );
}

export async function startViewer(options: ViewerOptions = {}): Promise<void> {
  injectStyles();
  initTooltips();
  const mount = document.getElementById('root');
  if (!mount) return;
  const root = createRoot(mount);

  let source;
  try {
    source = await resolveReportSource(new URLSearchParams(window.location.search), options);
  } catch (err) {
    console.error(err);
    source = null;
  }
  if (!source) {
    // No usable source at all (missing/rejected ?src=): a retry must re-run
    // source resolution, so reload the page rather than re-poll.
    root.render(
      <TreeView
        snapshot={createTreeStore().getSnapshot()}
        streaming={false}
        loadError
        onRetry={() => window.location.reload()}
      />,
    );
    return;
  }

  root.render(
    <TestReportViewer
      src={source.url}
      fetch={source.fetch}
      pollMs={source.pollMs}
      renderNodeActions={options.renderNodeActions}
      renderHeaderActions={options.renderHeaderActions}
    />,
  );
}
