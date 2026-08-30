import { afterEach, test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import type ReactTypes from 'react';
import type { Root } from 'react-dom/client';
import {
  progressFavicon, progressTitle, runProgress, useDocumentTitle, useFavicon,
} from '../src/client/tabStatus.ts';
import type { Counts, TreeSnapshot } from '@reporters/tree-core';

const dom = new JSDOM('', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
  // The arc that colour stands in for is half a percent of the ring — two pixels at favicon size.
  const [failedArc] = [...markup.matchAll(/stroke-dasharray="([\d.]+) /g)].map((m) => Number(m[1]));
  assert.ok(failedArc < RING_CIRCUMFERENCE / 100, `failed arc is ${failedArc} of ${RING_CIRCUMFERENCE}`);
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

test('useFavicon: drops its link when switched off, and on unmount', async () => {
  const { root, update } = await render({ icon: 'data:image/svg+xml,%3Csvg%3E' });
  await update({});
  assert.deepStrictEqual(icons(), []);
  await update({ icon: 'data:image/svg+xml,%3Csvg%3E' });
  assert.strictEqual(icons().length, 1);
  await act(async () => root.unmount());
  assert.deepStrictEqual(icons(), []);
});
