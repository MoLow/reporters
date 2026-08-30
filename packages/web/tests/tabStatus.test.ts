import { test } from 'node:test';
import assert from 'node:assert';
import { progressFavicon, progressTitle, runProgress } from '../src/client/tabStatus.ts';
import type { Counts, TreeSnapshot } from '@reporters/tree-core';

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

test('favicon: an idle run is the bare track ring', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({}), true)));
  assert.match(markup, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 16 16">/);
  assert.strictEqual(markup.match(/<circle/g)?.length, 1);
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
  assert.ok(lengths.reduce((a, b) => a + b, 0) < 2 * Math.PI * 6);
});

test('favicon: an all-passing run closes the ring', () => {
  const markup = svg(progressFavicon(runProgress(snapshot({ passed: 4, total: 4 }, true), false)));
  const [dash, gap] = [...markup.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)][0].slice(1).map(Number);
  assert.strictEqual(dash, Math.round(2 * Math.PI * 6 * 100) / 100);
  assert.strictEqual(gap, 0);
});
