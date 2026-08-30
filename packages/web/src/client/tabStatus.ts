import { useEffect, useRef } from 'react';
import type { Counts, TreeSnapshot } from '@reporters/tree-core';

/** What a tab can say about the run — the numbers the header already shows. */
export interface RunProgress {
  counts: Counts;
  /** Finished share (0–1) of the tests discovered *so far*. A live run's total
   *  grows as files are dequeued, so this can move backwards. */
  progress: number;
  /** Nothing has arrived yet: no counts, no summary — there is no run to show. */
  idle: boolean;
  /** Still streaming, or something is running or queued. */
  inProgress: boolean;
}

/** Statuses that get an arc, outermost first — failed leads so a failing run
 *  always paints red at 12 o'clock, wherever the rest of the ring lands. */
const RING: readonly (readonly [keyof Counts, string])[] = [
  ['failed', '#fb5a6a'],
  ['passed', '#34d27b'],
  ['skipped', '#8a93a1'],
  ['todo', '#7c9cff'],
  ['running', '#ffb13d'],
];
/** The not-yet-run remainder. A favicon is its own document, with no access to
 *  the page's CSS variables, so the ring's palette is spelled out here. */
const TRACK = '#5d6573';
const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function runProgress(snapshot: TreeSnapshot, streaming: boolean): RunProgress {
  const { counts } = snapshot;
  const finished = counts.total - counts.running - counts.queued;
  return {
    counts,
    progress: counts.total > 0 ? finished / counts.total : 0,
    idle: counts.total === 0 && !snapshot.summary,
    inProgress: !snapshot.summary && (streaming || counts.running > 0 || counts.queued > 0),
  };
}

/** `62% 3✕ · <page title>`. State leads because a tab strip truncates from the
 *  right, and floors because a run that has one test left is not at 100%. */
export function progressTitle(progress: RunProgress, baseTitle: string): string {
  if (progress.idle) return baseTitle;
  const failed = progress.counts.failed > 0 ? `${progress.counts.failed}✕` : '';
  const lead = progress.inProgress
    ? [`${Math.floor(progress.progress * 100)}%`, failed].filter(Boolean).join(' ')
    : failed || '✓';
  return baseTitle ? `${lead} · ${baseTitle}` : lead;
}

const round = (n: number): number => Math.round(n * 100) / 100;

function arc(color: string, length: number, offset: number): string {
  return `<circle cx="8" cy="8" r="${RADIUS}" fill="none" stroke="${color}" stroke-width="4"`
    + ` stroke-dasharray="${round(length)} ${round(CIRCUMFERENCE - length)}"`
    + ` stroke-dashoffset="${round(-offset)}" transform="rotate(-90 8 8)"/>`;
}

/** A `data:` URI for the run as a ring: one arc per status over the track, so
 *  the tab carries how far along the run is and how much of it is red without
 *  being read as text. */
export function progressFavicon(progress: RunProgress): string {
  const total = Math.max(progress.counts.total, 1);
  const arcs: string[] = [];
  let offset = 0;
  for (const [status, color] of RING) {
    const length = (progress.counts[status] / total) * CIRCUMFERENCE;
    if (length > 0) {
      arcs.push(arc(color, length, offset));
      offset += length;
    }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
    + `<circle cx="8" cy="8" r="${RADIUS}" fill="none" stroke="${TRACK}" stroke-width="4"/>`
    + `${arcs.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Show `next` in the tab, handing `baseTitle` back when it goes undefined or
 *  the viewer unmounts. */
export function useDocumentTitle(next: string | undefined, baseTitle: string): void {
  const owned = useRef(false);
  useEffect(() => {
    if (next === undefined) {
      if (owned.current) document.title = baseTitle;
      owned.current = false;
      return;
    }
    owned.current = true;
    if (document.title !== next) document.title = next;
  }, [next, baseTitle]);
  useEffect(() => () => { if (owned.current) document.title = baseTitle; }, [baseTitle]);
}

/** Show `href` as the tab's icon. Appended as a second `<link rel="icon">`
 *  rather than written into the page's own: browsers honour the last icon
 *  declared, so dropping ours restores whatever the page shipped with. */
export function useFavicon(href: string | undefined): void {
  const link = useRef<HTMLLinkElement | null>(null);
  useEffect(() => {
    if (href === undefined) {
      link.current?.remove();
      link.current = null;
      return;
    }
    if (!link.current) {
      link.current = document.createElement('link');
      link.current.rel = 'icon';
      link.current.type = 'image/svg+xml';
      document.head.appendChild(link.current);
    }
    // Re-assigning an unchanged href re-fetches the icon in some browsers, and
    // a live run re-renders several times a second.
    if (link.current.getAttribute('href') !== href) link.current.setAttribute('href', href);
  }, [href]);
  useEffect(() => () => { link.current?.remove(); link.current = null; }, []);
}
