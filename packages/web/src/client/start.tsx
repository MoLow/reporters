import React, {
  useCallback, useEffect, useInsertionEffect, useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createTreeStore, type TreeSnapshot } from '@reporters/tree-core';
import { createNdjsonReader, DEFAULT_POLL_MS, type FetchLike } from '../poll.ts';
import { resolveReportSource, type ViewerOptions as SourceOptions } from '../source.ts';
import { STYLES } from '../template.ts';
import { TreeView, type Density, type RenderHeaderActions, type RenderNodeActions } from './TreeView.tsx';
import { initTooltips } from './tooltip.ts';
import {
  progressTitle, runProgress, useDocumentTitle, useProgressFavicon, type RunProgress,
} from './tabStatus.ts';
import type { FilterStore } from './urlState.ts';

export type { ReportSource } from '../source.ts';
export type { FetchLike } from '../poll.ts';
export type { Density, RenderHeaderActions, RenderNodeActions } from './TreeView.tsx';
export { paintFavicon, progressFavicon, progressTitle, type RunProgress } from './tabStatus.ts';
export type { TestNode } from '@reporters/tree-core';
export { memoryFilterState, urlFilterState, type FilterState, type FilterStore } from './urlState.ts';

/** How the browser tab's title reflects the run: `true` for the built-in
 *  `62% 3✕ · <page title>` format, or a function returning the whole title —
 *  it receives the same progress the header renders, plus the title the page
 *  was serving when the viewer mounted. */
export type DocumentTitle = boolean | ((progress: RunProgress, baseTitle: string) => string);

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
  /** Keep the run in the page's title. On by default — the page is the
   *  viewer's own. Pass `false` to leave the title alone. */
  documentTitle?: DocumentTitle;
  /** Keep the run in the page's icon, as a ring of status arcs. On by default. */
  favicon?: boolean;
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
 *  `retry` restarts the stream from scratch after a load error. Without a
 *  `src` there is nothing to poll — the view settles on the load-error state. */
function useReportStream(src: string | undefined, fetchImpl: FetchLike | undefined, pollMs: number) {
  const [generation, setGeneration] = useState(0);
  const [view, setView] = useState<StreamView>(() => ({
    snapshot: createTreeStore().getSnapshot(), streaming: true, pending: true, loadError: false,
  }));
  useEffect(() => {
    let cancelled = false;
    let store = createTreeStore();
    if (!src) {
      setView({
        snapshot: store.getSnapshot(), streaming: false, pending: false, loadError: true,
      });
      return undefined;
    }
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
  /** URL of the NDJSON report; polled with HTTP Range while the run streams.
   *  Omit (e.g. while the host is still resolving where the report lives and
   *  has nothing to show) to render the load-error screen. */
  src?: string;
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
  /** Replaces the load-error screen's default retry (restart the stream) —
   *  e.g. re-run the host's own source resolution. With no `src` there is no
   *  stream to restart, so without this the retry button is hidden. */
  onRetry?: () => void;
  /** Row density: `compact` (default) or `cozy`. */
  dense?: Density;
  /** Put the run in the browser tab's title, restoring the page's own on
   *  unmount. Off by default: an embedded viewer shares the tab with its host,
   *  which owns what the tab says. */
  documentTitle?: DocumentTitle;
  /** Put the run in the browser tab's icon — a ring of failed/passed/skipped/
   *  todo/running arcs over the not-yet-run remainder, its centre dot breathing
   *  while the run is still going — restoring the page's own icon on unmount.
   *  Off by default, for the same reason. */
  favicon?: boolean;
}

function titleFor(option: DocumentTitle, progress: RunProgress, baseTitle: string): string | undefined {
  if (!option) return undefined;
  return typeof option === 'function' ? option(progress, baseTitle) : progressTitle(progress, baseTitle);
}

/** The report viewer as a React component: render it anywhere in a host app.
 *  Polls `src`, live-updates until the run's summary, and stops polling on
 *  unmount. Injects its stylesheet into document.head before first paint. */
export function TestReportViewer({
  src, fetch: fetchImpl, pollMs = DEFAULT_POLL_MS, renderNodeActions, renderHeaderActions, filters, onRetry, dense,
  documentTitle = false, favicon = false,
}: TestReportViewerProps) {
  useInsertionEffect(() => { injectStyles(); }, []);
  useEffect(() => { initTooltips(); }, []);
  const {
    snapshot, streaming, pending, loadError, retry,
  } = useReportStream(src, fetchImpl, pollMs);
  // Read before the first badge is written, so restoring can't hand back a
  // title of our own making.
  const [baseTitle] = useState(() => document.title);
  const progress = runProgress(snapshot, streaming);
  useDocumentTitle(titleFor(documentTitle, progress, baseTitle), baseTitle);
  useProgressFavicon(favicon ? progress : undefined);
  return (
    <TreeView
      snapshot={snapshot}
      streaming={streaming}
      pending={pending}
      loadError={loadError}
      onRetry={onRetry ?? (src ? retry : undefined)}
      renderNodeActions={renderNodeActions}
      renderHeaderActions={renderHeaderActions}
      filters={filters}
      dense={dense}
    />
  );
}

export async function startViewer(options: ViewerOptions = {}): Promise<void> {
  const mount = document.getElementById('root');
  if (!mount) return;

  let source;
  try {
    source = await resolveReportSource(new URLSearchParams(window.location.search), options);
  } catch (err) {
    console.error(err);
    source = null;
  }
  createRoot(mount).render(
    <TestReportViewer
      src={source?.url}
      fetch={source?.fetch}
      pollMs={source?.pollMs}
      renderNodeActions={options.renderNodeActions}
      renderHeaderActions={options.renderHeaderActions}
      documentTitle={options.documentTitle ?? true}
      favicon={options.favicon ?? true}
      // No usable source (missing/rejected ?src=): a retry must re-run source
      // resolution, so reload the page rather than restart a stream.
      onRetry={source ? undefined : () => window.location.reload()}
    />,
  );
}
