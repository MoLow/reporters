import { useEffect, useRef, useState } from 'react';
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

/** The favicon's palette. A favicon is its own document, with no access to the page's CSS
 *  variables, so the colours are spelled out here. */
const COLOR = {
  failed: '#fb5a6a',
  passed: '#34d27b',
  skipped: '#8a93a1',
  todo: '#7c9cff',
  running: '#ffb13d',
  /** Discovered but not yet run — the ring's unspent remainder. */
  queued: '#5d6573',
} as const;

/** Statuses that get an arc, in ring order — failed leads so a failing run paints red at 12
 *  o'clock, wherever the rest of the ring lands. `queued` is the track they are drawn over. */
const RING: readonly (keyof Counts & keyof typeof COLOR)[] = ['failed', 'passed', 'skipped', 'todo', 'running'];

/** The icon's own coordinate space. A unit is a pixel at the 16px a tab strip actually shows. */
const VIEWBOX = 16;
const CENTRE = VIEWBOX / 2;
const RADIUS = 6.5;
const RING_WIDTH = 3;
/** The verdict dot, sized to leave a gap inside the arcs so the two never read as one shape. It is
 *  the part that survives being scaled to a favicon: at 16px the arcs are texture, and a run that
 *  fails two of four hundred tests would otherwise paint two red pixels and read as passing. */
const DOT_RADIUS = 3.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Side of the raster drawn from that space: 2× covers a 16px tab strip on a retina display, and
 *  browsers downscale a too-large icon far more gracefully than they upscale a too-small one. */
const RASTER = VIEWBOX * 2;

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

/** Arc lengths around the ring, one per `RING` status, in viewBox units.
 *
 *  Rounded, because the counts behind them change several times a second and an exact ring mints a
 *  new icon for boundaries no display can resolve — every one of which costs the browser an icon
 *  swap. Rounded *cumulatively* rather than per arc, so the arcs still tile the ring end to end
 *  instead of drifting apart. A status holding anything at all keeps one unit even when its share
 *  rounds to nothing, borrowed from the longest arc: two failures in four hundred is precisely the
 *  case the ring must not swallow. */
function ringLengths(counts: Counts): number[] {
  const total = Math.max(counts.total, 1);
  const lengths: number[] = [];
  let share = 0;
  let drawn = 0;
  for (const status of RING) {
    share += counts[status] / total;
    const end = Math.min(Math.round(share * CIRCUMFERENCE), CIRCUMFERENCE);
    lengths.push(end - drawn);
    drawn = end;
  }
  RING.forEach((status, i) => {
    if (counts[status] === 0 || lengths[i] > 0) return;
    const longest = lengths.indexOf(Math.max(...lengths));
    if (longest !== i && lengths[longest] > 1) {
      lengths[longest] -= 1;
      lengths[i] = 1;
    }
  });
  return lengths;
}

function arc(color: string, length: number, offset: number): string {
  return `<circle cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" fill="none" stroke="${color}" stroke-width="${RING_WIDTH}"`
    + ` stroke-dasharray="${round(length)} ${round(CIRCUMFERENCE - length)}"`
    + ` stroke-dashoffset="${round(-offset)}" transform="rotate(-90 ${CENTRE} ${CENTRE})"/>`;
}

/** The colour the run as a whole is going: one failure makes it red, whatever the other counts. */
function verdictColor(progress: RunProgress): string {
  if (progress.counts.failed > 0) return COLOR.failed;
  return progress.inProgress ? COLOR.running : COLOR.passed;
}

/** A `data:` URI for the run: a filled dot in the verdict's colour, ringed by the breakdown — one
 *  arc per status over the not-yet-run remainder. The fallback icon, for anything that cannot hand
 *  out a 2D context; `paintFavicon` is what a browser normally shows. */
export function progressFavicon(progress: RunProgress): string {
  const lengths = ringLengths(progress.counts);
  const arcs: string[] = [];
  let offset = 0;
  RING.forEach((status, i) => {
    if (lengths[i] <= 0) return;
    arcs.push(arc(COLOR[status], lengths[i], offset));
    offset += lengths[i];
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">`
    + `<circle cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" fill="none" stroke="${COLOR.queued}" stroke-width="${RING_WIDTH}"/>`
    + arcs.join('')
    + `<circle cx="${CENTRE}" cy="${CENTRE}" r="${DOT_RADIUS}" fill="${verdictColor(progress)}"/>`
    + '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface Scratch { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

/** One canvas for the life of the page: a breathing run repaints five times a second, and a fresh
 *  canvas per frame is the only cost in that loop that grows. `null` wherever the environment will
 *  not hand out a 2D context — the icon falls back to `progressFavicon`, which needs none. */
let scratch: Scratch | null = null;

function scratchIcon(): Scratch | null {
  if (scratch) return scratch;
  const canvas = document.createElement('canvas');
  canvas.width = RASTER;
  canvas.height = RASTER;
  const ctx = canvas.getContext('2d');
  scratch = ctx ? { canvas, ctx } : null;
  return scratch;
}

/** The same icon, rasterised — a PNG `data:` URI, or `undefined` where no canvas is available.
 *
 *  Worth the canvas because of how a browser swaps an icon: the new href is decoded asynchronously,
 *  and until it lands the tab paints the next-best candidate it already holds — the page's own
 *  `<link rel="icon">`, sitting right there. A run that repaints constantly turns that gap into a
 *  visible flicker back to the host's favicon. A raster is decoded then and there.
 *
 *  `dotScale` shrinks the verdict dot for the pulse; the ring is never touched by it. */
export function paintFavicon(progress: RunProgress, dotScale = 1): string | undefined {
  const icon = scratchIcon();
  if (!icon) return undefined;
  const { canvas, ctx } = icon;
  ctx.setTransform(RASTER / VIEWBOX, 0, 0, RASTER / VIEWBOX, 0, 0);
  ctx.clearRect(0, 0, VIEWBOX, VIEWBOX);
  ctx.lineWidth = RING_WIDTH;
  const stroke = (color: string, from: number, to: number) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.arc(CENTRE, CENTRE, RADIUS, from, to);
    ctx.stroke();
  };
  stroke(COLOR.queued, 0, 2 * Math.PI);
  const lengths = ringLengths(progress.counts);
  // Twelve o'clock, matching the SVG's rotate(-90): the arcs start where the eye does.
  let angle = -Math.PI / 2;
  RING.forEach((status, i) => {
    if (lengths[i] <= 0) return;
    const end = angle + lengths[i] / RADIUS;
    stroke(COLOR[status], angle, end);
    angle = end;
  });
  ctx.beginPath();
  ctx.fillStyle = verdictColor(progress);
  ctx.arc(CENTRE, CENTRE, DOT_RADIUS * dotScale, 0, 2 * Math.PI);
  ctx.fill();
  return canvas.toDataURL('image/png');
}

const PULSE_PERIOD_MS = 1600;
const PULSE_FRAME_MS = 200;
/** How far the dot shrinks at the bottom of a breath. Shallow deliberately: a tab strip is
 *  peripheral vision, and a dot that collapses reads as a second status rather than a heartbeat. */
const PULSE_DEPTH = 0.28;

function pulseScale(elapsedMs: number): number {
  const phase = ((elapsedMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS) * 2 * Math.PI;
  return 1 - (PULSE_DEPTH * (1 - Math.cos(phase))) / 2;
}

/** The breath the verdict dot takes while the run is going, and the still `1` the moment it lands
 *  — stopping is how the icon says "finished" without changing shape.
 *
 *  On an interval rather than animation frames: frames are suspended outright in a background tab,
 *  which is the tab this icon exists for. A hidden tab clamps the interval to about a second, so
 *  the pulse coarsens there into a slow blink instead of freezing. */
function usePulse(active: boolean): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!active || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setScale(1);
      return undefined;
    }
    const started = Date.now();
    const timer = setInterval(() => setScale(pulseScale(Date.now() - started)), PULSE_FRAME_MS);
    return () => clearInterval(timer);
  }, [active]);
  return scale;
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

/** A `<link rel="icon">`'s `type`, which browsers use to skip icons they cannot decode — so it has
 *  to follow the href across the raster/vector fallback rather than being fixed at either. Absent
 *  for an href that does not carry its type: no hint beats a wrong one, and the browser sniffs. */
function iconType(href: string): string | undefined {
  return /^data:([^;,]+)/.exec(href)?.[1];
}

interface Held<T> { current: T | null }

/** Detach the page's own icons, so ours is the only one the browser has to choose between.
 *
 *  Sitting ours after theirs and trusting "the last icon declared wins" leaves both in the
 *  candidate set, and the browser re-runs that choice on every swap — with a `/favicon.ico` it
 *  can still go and fetch sitting in it. An icon that changes several times a second turns that
 *  into a standing cost. `rel~="icon"` is the candidate set exactly: it takes `shortcut icon`
 *  along with `icon`, and leaves `apple-touch-icon`, which was never competing, alone. */
function seizeIcons(): HTMLLinkElement[] {
  const theirs = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
  theirs.forEach((link) => link.remove());
  return theirs;
}

/** Drop ours and hand the page its own icons back, in the order it declared them. */
function releaseIcons(ours: Held<HTMLLinkElement>, theirs: Held<HTMLLinkElement[]>): void {
  ours.current?.remove();
  ours.current = null;
  theirs.current?.forEach((link) => document.head.appendChild(link));
  theirs.current = null;
}

/** Show `href` as the tab's icon, for as long as the viewer wants it — the page's own icons come
 *  down for the duration and go back up when it stops. */
export function useFavicon(href: string | undefined): void {
  const link = useRef<HTMLLinkElement | null>(null);
  const theirs = useRef<HTMLLinkElement[] | null>(null);
  useEffect(() => {
    if (href === undefined) {
      releaseIcons(link, theirs);
      return;
    }
    if (!link.current) {
      theirs.current = seizeIcons();
      link.current = document.createElement('link');
      link.current.rel = 'icon';
      document.head.appendChild(link.current);
    }
    // Re-assigning an unchanged href re-fetches the icon in some browsers, and
    // a live run re-renders several times a second.
    if (link.current.getAttribute('href') !== href) {
      const type = iconType(href);
      if (type) link.current.type = type;
      else link.current.removeAttribute('type');
      link.current.setAttribute('href', href);
    }
  }, [href]);
  useEffect(() => () => releaseIcons(link, theirs), []);
}

/** Put the run in the tab's icon: rastered and breathing where a canvas allows it, flat SVG where
 *  it does not. `undefined` leaves the page's own icon alone. */
export function useProgressFavicon(progress: RunProgress | undefined): void {
  // Only the raster carries the breath, and a pulse the SVG cannot show is a timer waking five
  // times a second to redraw the icon it already drew.
  const dotScale = usePulse(progress?.inProgress === true && scratchIcon() !== null);
  useFavicon(progress && (paintFavicon(progress, dotScale) ?? progressFavicon(progress)));
}
