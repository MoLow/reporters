import { afterEach, test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import type ReactTypes from 'react';
import type { Root } from 'react-dom/client';
import {
  paintFavicon, progressFavicon, progressTitle, runProgress,
  useDocumentTitle, useFavicon, useProgressFavicon, type RunProgress,
} from '../src/client/tabStatus.ts';
import type { Counts, TreeSnapshot } from '@reporters/tree-core';

const dom = new JSDOM('', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom draws nothing, and the rastered icon is the one a browser actually gets. A recording
// context stands in for the real one: every arc the painter asks for, in the order it asks.
interface Painted { color: string; args: number[] }
const painted: Painted[] = [];
let pending: number[] = [];
const recorder = {
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  setTransform() {},
  clearRect() { painted.length = 0; },
  beginPath() { pending = []; },
  arc(...args: number[]) { pending = args; },
  stroke() { painted.push({ color: recorder.strokeStyle, args: pending }); },
  fill() { painted.push({ color: recorder.fillStyle, args: pending }); },
};
const PNG = 'data:image/png;base64,STUB';
let context2d: unknown = recorder;
dom.window.HTMLCanvasElement.prototype.getContext = (() => context2d) as never;
dom.window.HTMLCanvasElement.prototype.toDataURL = (() => PNG) as never;

/** Radius of the last shape painted — the verdict dot is always drawn last. */
const dotRadius = (): number => painted[painted.length - 1].args[2];

// react-dom snapshots the environment at module evaluation, so it loads only
// once the DOM globals above exist. The hooks under test are the source
// module's, not the bundle's — they own the page's title and icon, which no
// pure assertion can reach.
const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');

const counts = (over: Partial<Counts> = {}): Counts => ({
  passed: 0, failed: 0, skipped: 0, todo: 0, running: 0, queued: 0, carried: 0, total: 0, ...over,
});

const snapshot = (c: Partial<Counts>, summary?: boolean): TreeSnapshot => ({
  version: 1,
  root: {} as TreeSnapshot['root'],
  counts: counts(c),
  ...(summary ? { summary: { durationMs: 1, success: true } as TreeSnapshot['summary'] } : {}),
});

test('progress is the finished share of what has been discovered so far', () => {
  const p = runProgress(snapshot({
    passed: 3, failed: 1, running: 2, queued: 4, total: 10,
  }), true);
  assert.strictEqual(p.progress, 0.4);
  assert.strictEqual(p.inProgress, true);
  assert.strictEqual(p.idle, false);
});

test('an empty stream is idle, and a finished run is neither idle nor in progress', () => {
  assert.strictEqual(runProgress(snapshot({}), true).idle, true);
  const done = runProgress(snapshot({ passed: 2, total: 2 }, true), false);
  assert.strictEqual(done.idle, false);
  assert.strictEqual(done.inProgress, false);
  assert.strictEqual(done.progress, 1);
});

test('a stream that has stopped without a summary is no longer in progress', () => {
  assert.strictEqual(runProgress(snapshot({ passed: 2, total: 2 }), false).inProgress, false);
});

test('title: an idle viewer keeps the page title untouched', () => {
  assert.strictEqual(progressTitle(runProgress(snapshot({}), true), 'node:test viewer'), 'node:test viewer');
});

test('title: a live run leads with the percentage, and the failures once there are any', () => {
  const live = (c: Partial<Counts>) => progressTitle(runProgress(snapshot(c), true), 'run 42');
  assert.strictEqual(live({ passed: 5, queued: 5, total: 10 }), '50% · run 42');
  assert.strictEqual(live({ passed: 4, failed: 3, queued: 3, total: 10 }), '70% 3✕ · run 42');
});

test('title: the percentage floors, so a run with anything left never reads 100%', () => {
  const p = runProgress(snapshot({ passed: 999, running: 1, total: 1000 }), true);
  assert.strictEqual(progressTitle(p, 'run 42'), '99% · run 42');
});

test('title: a finished run reads as its verdict', () => {
  const done = (c: Partial<Counts>) => progressTitle(runProgress(snapshot(c, true), false), 'run 42');
  assert.strictEqual(done({ passed: 10, total: 10 }), '✓ · run 42');
  assert.strictEqual(done({ passed: 7, failed: 3, total: 10 }), '3✕ · run 42');
});

test('title: a page with no title of its own gets the run alone', () => {
  assert.strictEqual(progressTitle(runProgress(snapshot({ passed: 1, queued: 1, total: 2 }), true), ''), '50%');
});

const svg = (uri: string): string => {
  assert.ok(uri.startsWith('data:image/svg+xml,'));
  return decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
};

const RING_CIRCUMFERENCE = Math.round(2 * Math.PI * 6.5 * 100) / 100;
/** The verdict dot is the last circle drawn, and the only filled one. */
const dotColor = (markup: string): string | undefined => /<circle[^>]*fill="(#[0-9a-f]{6})"/.exec(markup)?.[1];

test('favicon: an idle run is the bare track ring around the dot', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({}), true)));
  assert.match(markup, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 16 16">/);
  assert.strictEqual(markup.match(/<circle/g)?.length, 2, 'the track and the dot, no arcs');
});

test('favicon: one arc per non-empty status, failed first and laid end to end', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({
    passed: 5, failed: 1, running: 2, queued: 2, total: 10,
  }), true)));
  const strokes = [...markup.matchAll(/stroke="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
  assert.deepStrictEqual(strokes, ['#5d6573', '#fb5a6a', '#34d27b', '#ffb13d']);
  const offsets = [...markup.matchAll(/stroke-dashoffset="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
  const lengths = [...markup.matchAll(/stroke-dasharray="([\d.]+) /g)].map((m) => Number(m[1]));
  assert.deepStrictEqual(offsets, [0, -lengths[0], -(lengths[0] + lengths[1])].map((n) => Math.round(n * 100) / 100));
  // Queued is the only status left unpainted: it is what the track shows.
  assert.ok(lengths.reduce((a, b) => a + b, 0) < RING_CIRCUMFERENCE);
});

test('favicon: an all-passing run closes the ring', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({ passed: 4, total: 4 }, true), false)));
  const [dash, gap] = [...markup.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)][0].slice(1).map(Number);
  assert.strictEqual(dash, RING_CIRCUMFERENCE);
  assert.strictEqual(gap, 0);
});

test('favicon: the dot is the verdict — one failure in a sea of passes still reads red', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({
    passed: 347, failed: 2, skipped: 9, todo: 6, total: 364,
  }, true), false)));
  assert.strictEqual(dotColor(markup), '#fb5a6a');
  // The arc that colour stands in for is the ring's rounding floor: one unit of red in forty.
  const [failedArc] = [...markup.matchAll(/stroke-dasharray="([\d.]+) /g)].map((m) => Number(m[1]));
  assert.strictEqual(failedArc, 1);
});

test('favicon: a clean run is amber while it runs and green once it lands', () => {
  const live = svg(progressFavicon(runProgress(snapshot({ passed: 5, running: 1, queued: 4, total: 10 }), true)));
  assert.strictEqual(dotColor(live), '#ffb13d');
  const done = svg(progressFavicon(runProgress(snapshot({ passed: 10, total: 10 }, true), false)));
  assert.strictEqual(dotColor(done), '#34d27b');
});

test('favicon: a failure outranks a run still in progress', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({
    passed: 4, failed: 1, running: 1, queued: 4, total: 10,
  }), true)));
  assert.strictEqual(dotColor(markup), '#fb5a6a');
});

test('favicon: the ring is quantised, so a change no pixel can show does not mint a new icon', () => {
  const icon = (passed: number) => progressFavicon(runProgress(snapshot({
    passed, queued: 1000 - passed, total: 1000,
  }), true));
  assert.strictEqual(icon(501), icon(500), 'one test in a thousand moves no boundary');
  assert.notStrictEqual(icon(520), icon(500), 'two percent of the ring is a pixel, and does');
});

test('favicon: quantised arcs still tile the ring end to end', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({
    passed: 137, failed: 11, skipped: 3, todo: 2, running: 4, queued: 43, total: 200,
  }), true)));
  const lengths = [...markup.matchAll(/stroke-dasharray="([\d.]+) /g)].map((m) => Number(m[1]));
  const offsets = [...markup.matchAll(/stroke-dashoffset="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
  // Each arc begins exactly where the one before it ended: no seams, no overlap.
  let end = 0;
  lengths.forEach((length, i) => {
    assert.strictEqual(Math.abs(offsets[i]), end, `arc ${i} starts at ${-offsets[i]}, not ${end}`);
    assert.strictEqual(length, Math.round(length), `arc ${i} is ${length}, not a whole unit`);
    end += length;
  });
  assert.ok(end <= RING_CIRCUMFERENCE, `arcs total ${end}, past the ring's ${RING_CIRCUMFERENCE}`);
});

const mounted: Root[] = [];
afterEach(async () => {
  const roots = mounted.splice(0);
  await act(async () => { for (const r of roots) r.unmount(); });
});

interface HarnessProps { title?: string; baseTitle?: string; icon?: string }

function Harness({ title, baseTitle = '', icon }: HarnessProps) {
  useDocumentTitle(title, baseTitle);
  useFavicon(icon);
  return null;
}

async function render(props: HarnessProps): Promise<{ root: Root; update: (next: HarnessProps) => Promise<void> }> {
  const root = createRoot(dom.window.document.createElement('div'));
  mounted.push(root);
  const draw = (p: HarnessProps) => act(async () => {
    root.render(React.createElement(Harness as ReactTypes.FunctionComponent<HarnessProps>, p));
  });
  await draw(props);
  return { root, update: draw };
}

const icons = () => [...dom.window.document.head.querySelectorAll('link[rel="icon"]')] as HTMLLinkElement[];

test('useDocumentTitle: follows the title it is given', async () => {
  dom.window.document.title = 'host app';
  const { update } = await render({ title: '10% · host app', baseTitle: 'host app' });
  assert.strictEqual(dom.window.document.title, '10% · host app');
  await update({ title: '90% 2✕ · host app', baseTitle: 'host app' });
  assert.strictEqual(dom.window.document.title, '90% 2✕ · host app');
});

test('useDocumentTitle: hands the base title back when switched off, and again on unmount', async () => {
  dom.window.document.title = 'host app';
  const { root, update } = await render({ title: '10% · host app', baseTitle: 'host app' });
  await update({ baseTitle: 'host app' });
  assert.strictEqual(dom.window.document.title, 'host app');

  // Switched off, the hook owns nothing: a title the host sets afterwards has
  // to survive the unmount that follows.
  dom.window.document.title = 'host app, elsewhere';
  await act(async () => root.unmount());
  assert.strictEqual(dom.window.document.title, 'host app, elsewhere');
});

test('useDocumentTitle: restores on unmount', async () => {
  dom.window.document.title = 'host app';
  const { root } = await render({ title: '10% · host app', baseTitle: 'host app' });
  await act(async () => root.unmount());
  assert.strictEqual(dom.window.document.title, 'host app');
});

test('useDocumentTitle: leaves a page it was never given a title for alone', async () => {
  dom.window.document.title = 'host app';
  const { root } = await render({ baseTitle: 'host app' });
  assert.strictEqual(dom.window.document.title, 'host app');
  await act(async () => root.unmount());
  assert.strictEqual(dom.window.document.title, 'host app');
});

test('useFavicon: adds one icon link and re-points that same element', async () => {
  const { update } = await render({ icon: 'data:image/svg+xml,%3Csvg%3E' });
  assert.strictEqual(icons().length, 1);
  const [link] = icons();
  assert.strictEqual(link.getAttribute('type'), 'image/svg+xml');
  await update({ icon: 'data:image/svg+xml,%3Csvg%20id%3D%222%22%3E' });
  assert.deepStrictEqual(icons(), [link], 'the same link, re-pointed');
  assert.strictEqual(link.getAttribute('href'), 'data:image/svg+xml,%3Csvg%20id%3D%222%22%3E');
});

test('useFavicon: an href that does not carry its type is given no type hint', async () => {
  const { update } = await render({ icon: 'data:image/png;base64,STUB' });
  assert.strictEqual(icons()[0].getAttribute('type'), 'image/png');
  await update({ icon: '/favicon.ico' });
  assert.strictEqual(icons()[0].getAttribute('href'), '/favicon.ico');
  assert.strictEqual(icons()[0].getAttribute('type'), null, 'a wrong hint is worse than none');
});

test('useFavicon: drops its link when switched off, and on unmount', async () => {
  const { root, update } = await render({ icon: 'data:image/svg+xml,%3Csvg%3E' });
  await update({});
  assert.deepStrictEqual(icons(), []);
  await update({ icon: 'data:image/svg+xml,%3Csvg%3E' });
  assert.strictEqual(icons().length, 1);
  await act(async () => root.unmount());
  assert.deepStrictEqual(icons(), []);
});

interface IconProps { progress?: RunProgress }

function IconHarness({ progress }: IconProps) {
  useProgressFavicon(progress);
  return null;
}

async function renderIcon(props: IconProps): Promise<{ update: (next: IconProps) => Promise<void> }> {
  const root = createRoot(dom.window.document.createElement('div'));
  mounted.push(root);
  const draw = (p: IconProps) => act(async () => {
    root.render(React.createElement(IconHarness as ReactTypes.FunctionComponent<IconProps>, p));
  });
  await draw(props);
  return { update: draw };
}

const DOT = 3.5;
const PULSE_DEPTH = 0.28;

// Everything below paints, and the module keeps the first canvas it is given a context for — so
// the environment that has none has to be asked about before any of it runs.
test('paintFavicon: with no 2D context there is no raster, and the SVG stands in', async () => {
  context2d = null;
  try {
    const progress = runProgress(snapshot({ passed: 1, queued: 1, total: 2 }), true);
    assert.strictEqual(paintFavicon(progress), undefined);
    await renderIcon({ progress });
    assert.strictEqual(icons()[0].getAttribute('href'), progressFavicon(progress));
    assert.strictEqual(icons()[0].getAttribute('type'), 'image/svg+xml');
  } finally {
    context2d = recorder;
  }
});

test('paintFavicon: the track, then one arc per status in ring order, then the verdict dot', () => {
  assert.strictEqual(paintFavicon(runProgress(snapshot({
    passed: 5, failed: 1, running: 2, queued: 2, total: 10,
  }), true)), PNG);
  assert.deepStrictEqual(
    painted.map((shape) => shape.color),
    ['#5d6573', '#fb5a6a', '#34d27b', '#ffb13d', '#fb5a6a'],
  );
  const arcs = painted.slice(1, -1);
  assert.strictEqual(arcs[0].args[3], -Math.PI / 2, 'the ring opens at twelve o\'clock');
  arcs.forEach((shape, i) => {
    if (i > 0) assert.strictEqual(shape.args[3], arcs[i - 1].args[4], `arc ${i} leaves a seam`);
  });
});

test('paintFavicon: dotScale moves the dot and nothing else', () => {
  const progress = runProgress(snapshot({ passed: 5, running: 1, queued: 4, total: 10 }), true);
  paintFavicon(progress);
  const ring = painted.slice(0, -1).map((shape) => shape.args.join());
  assert.strictEqual(dotRadius(), DOT);
  paintFavicon(progress, 1 - PULSE_DEPTH);
  assert.strictEqual(dotRadius(), DOT * (1 - PULSE_DEPTH));
  assert.deepStrictEqual(painted.slice(0, -1).map((shape) => shape.args.join()), ring);
});

test('useProgressFavicon: the tab gets the raster, and the link type follows it', async () => {
  await renderIcon({ progress: runProgress(snapshot({ passed: 5, running: 1, queued: 4, total: 10 }), true) });
  assert.strictEqual(icons().length, 1);
  assert.strictEqual(icons()[0].getAttribute('href'), PNG);
  assert.strictEqual(icons()[0].getAttribute('type'), 'image/png');
});

test('useProgressFavicon: the dot breathes while the run does, and holds still once it lands', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  const { update } = await renderIcon({
    progress: runProgress(snapshot({ passed: 5, running: 1, queued: 4, total: 10 }), true),
  });
  assert.strictEqual(dotRadius(), DOT, 'a breath starts full');
  await act(async () => { t.mock.timers.tick(800); });
  assert.strictEqual(dotRadius(), DOT * (1 - PULSE_DEPTH), 'half a period in, at its smallest');
  await act(async () => { t.mock.timers.tick(800); });
  assert.strictEqual(dotRadius(), DOT, 'and back');

  await update({ progress: runProgress(snapshot({ passed: 10, total: 10 }, true), false) });
  assert.strictEqual(dotRadius(), DOT, 'a landed run sits at full');
  await act(async () => { t.mock.timers.tick(5_000); });
  assert.strictEqual(painted.length, 3, 'and is not repainted again');
});

test('useProgressFavicon: no progress leaves the page\'s own icon alone', async () => {
  await renderIcon({});
  assert.deepStrictEqual(icons(), []);
});


test('useProgressFavicon: prefers-reduced-motion leaves the dot still', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'] });
  (dom.window as any).matchMedia = (query: string) => ({ matches: query.includes('prefers-reduced-motion') });
  try {
    await renderIcon({
      progress: runProgress(snapshot({ passed: 5, running: 1, queued: 4, total: 10 }), true),
    });
    const shapes = painted.length;
    assert.strictEqual(dotRadius(), DOT);
    await act(async () => { t.mock.timers.tick(5_000); });
    assert.strictEqual(painted.length, shapes, 'a run that would breathe is never repainted');
    assert.strictEqual(dotRadius(), DOT);
  } finally {
    delete (dom.window as any).matchMedia;
  }
});
