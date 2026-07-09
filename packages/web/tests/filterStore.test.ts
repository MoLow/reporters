import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { memoryFilterState, urlFilterState, type FilterState } from '../src/client/urlState.ts';

const dom = new JSDOM('', { url: 'http://localhost/?src=/run.ndjson' });
(globalThis as any).window = dom.window;

const state = (patch?: Partial<FilterState>): FilterState => ({
  query: '', statuses: new Set(), onlyRerun: false, ...patch,
});
const wait = (ms: number) => new Promise((r) => { setTimeout(r, ms); });
const resetUrl = () => dom.window.history.replaceState(null, '', '/?src=/run.ndjson');

test('memoryFilterState: starts at defaults, remembers writes across reads', () => {
  const store = memoryFilterState();
  assert.deepStrictEqual(store.read(), state());
  store.write(state({ query: 'adds', onlyRerun: true }));
  assert.deepStrictEqual(store.read(), state({ query: 'adds', onlyRerun: true }));
});

test('memoryFilterState: seeds from the initial partial', () => {
  const store = memoryFilterState({ statuses: new Set(['failed']) });
  assert.deepStrictEqual([...store.read().statuses], ['failed']);
  assert.strictEqual(store.read().query, '');
});

test('urlFilterState: read parses the current search', () => {
  dom.window.history.replaceState(null, '', '/?src=/run.ndjson&q=x&status=failed&rerun=1');
  const store = urlFilterState();
  assert.deepStrictEqual(store.read(), state({ query: 'x', statuses: new Set(['failed']), onlyRerun: true }));
  resetUrl();
});

test('urlFilterState: discrete changes push immediately, preserving other params', () => {
  const store = urlFilterState();
  store.write(state({ statuses: new Set(['failed']) }));
  assert.strictEqual(dom.window.location.search, '?src=%2Frun.ndjson&status=failed');
  resetUrl();
});

test('urlFilterState: query changes debounce into one history entry', async () => {
  const store = urlFilterState();
  const entries = dom.window.history.length;
  store.write(state({ query: 'a' }));
  store.write(state({ query: 'ad' }));
  store.write(state({ query: 'adds' }));
  assert.strictEqual(new URLSearchParams(dom.window.location.search).get('q'), null, 'nothing pushed synchronously');
  await wait(450);
  assert.strictEqual(new URLSearchParams(dom.window.location.search).get('q'), 'adds');
  assert.strictEqual(new URLSearchParams(dom.window.location.search).get('src'), '/run.ndjson', 'unrelated params preserved');
  assert.strictEqual(dom.window.history.length, entries + 1, 'keystrokes coalesce into one entry');
  resetUrl();
});

test('urlFilterState: a write matching the URL pushes nothing', async () => {
  dom.window.history.replaceState(null, '', '/?src=/run.ndjson&q=adds');
  const store = urlFilterState();
  const entries = dom.window.history.length;
  store.write(state({ query: 'adds' }));
  await wait(450);
  assert.strictEqual(dom.window.history.length, entries);
  resetUrl();
});

test('urlFilterState: subscribe reports Back/Forward, unsubscribe stops it', async () => {
  const store = urlFilterState();
  const seen: FilterState[] = [];
  const unsubscribe = store.subscribe!((s) => seen.push(s));
  store.write(state({ statuses: new Set(['failed']) }));
  dom.window.history.back();
  await wait(50); // jsdom dispatches popstate asynchronously
  assert.strictEqual(seen.length, 1);
  assert.deepStrictEqual([...seen[0].statuses], []);
  unsubscribe();
  dom.window.history.forward();
  await wait(50);
  assert.strictEqual(seen.length, 1, 'no callbacks after unsubscribe');
  dom.window.history.back();
  await wait(50);
  resetUrl();
});
