import { test } from 'node:test';
import assert from 'node:assert';
import { parseFilterState, serializeFilterState } from '../src/client/urlState.ts';
import type { FilterState } from '../src/client/urlState.ts';

const state = (over: Partial<FilterState> = {}): FilterState => ({
  query: '', statuses: new Set(), onlyRerun: false, ...over,
});

test('parse: empty search yields defaults', () => {
  const s = parseFilterState('');
  assert.strictEqual(s.query, '');
  assert.strictEqual(s.statuses.size, 0);
  assert.strictEqual(s.onlyRerun, false);
});

test('parse: reads q, status and rerun', () => {
  const s = parseFilterState('?q=login%20flow&status=failed,skipped&rerun=1');
  assert.strictEqual(s.query, 'login flow');
  assert.deepStrictEqual([...s.statuses].sort(), ['failed', 'skipped']);
  assert.strictEqual(s.onlyRerun, true);
});

test('parse: drops unknown status tokens', () => {
  const s = parseFilterState('?status=failed,bogus,,passed');
  assert.deepStrictEqual([...s.statuses].sort(), ['failed', 'passed']);
});

test('parse: rerun only turns on for "1"', () => {
  assert.strictEqual(parseFilterState('?rerun=0').onlyRerun, false);
  assert.strictEqual(parseFilterState('?rerun=').onlyRerun, false);
  assert.strictEqual(parseFilterState('?rerun=1').onlyRerun, true);
});

test('serialize: defaults produce no filter params', () => {
  assert.strictEqual(serializeFilterState(state(), ''), '');
});

test('serialize: keeps unrelated params like src and theme', () => {
  const out = serializeFilterState(state(), '?src=http%3A%2F%2Fx%2Flog.ndjson&theme=dark');
  const params = new URLSearchParams(out);
  assert.strictEqual(params.get('src'), 'http://x/log.ndjson');
  assert.strictEqual(params.get('theme'), 'dark');
  assert.strictEqual(params.has('q'), false);
});

test('serialize: writes active filters and clears stale ones', () => {
  const out = serializeFilterState(
    state({ query: 'a b', statuses: new Set(['failed']), onlyRerun: true }),
    '?src=s&status=passed',
  );
  const params = new URLSearchParams(out);
  assert.strictEqual(params.get('q'), 'a b');
  assert.strictEqual(params.get('status'), 'failed');
  assert.strictEqual(params.get('rerun'), '1');
  assert.strictEqual(params.get('src'), 's');
});

test('serialize: removing filters removes their params', () => {
  const out = serializeFilterState(state(), '?q=x&status=failed&rerun=1&src=s');
  assert.strictEqual(out, '?src=s');
});

test('round-trip preserves state', () => {
  const original = state({ query: '  spa ces & ?#', statuses: new Set(['todo', 'running']), onlyRerun: true });
  const back = parseFilterState(serializeFilterState(original, ''));
  assert.strictEqual(back.query, original.query);
  assert.deepStrictEqual([...back.statuses].sort(), [...original.statuses].sort());
  assert.strictEqual(back.onlyRerun, true);
});

test('serialize: status order is stable regardless of set insertion order', () => {
  const a = serializeFilterState(state({ statuses: new Set(['skipped', 'failed']) }), '');
  const b = serializeFilterState(state({ statuses: new Set(['failed', 'skipped']) }), '');
  assert.strictEqual(a, b);
});
