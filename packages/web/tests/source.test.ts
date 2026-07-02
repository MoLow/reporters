import { test } from 'node:test';
import assert from 'node:assert';
import { resolveReportSource } from '../src/source.ts';
import { DEFAULT_POLL_MS } from '../src/poll.ts';

const params = (query: string) => new URLSearchParams(query);

test('without a resolver, ?src= yields a plain source with the default cadence', async () => {
  const source = await resolveReportSource(params('src=https://x/run.ndjson'));
  assert.deepStrictEqual(source, { url: 'https://x/run.ndjson', fetch: undefined, pollMs: DEFAULT_POLL_MS });
});

test('without a resolver and without ?src=, resolves to null', async () => {
  assert.strictEqual(await resolveReportSource(params('')), null);
});

test('?poll= flows into the default source cadence', async () => {
  const source = await resolveReportSource(params('src=https://x/run.ndjson&poll=250'));
  assert.strictEqual(source!.pollMs, 250);
});

test('a resolver-returned source wins over ?src=', async () => {
  const customFetch = async () => ({ status: 200, text: async () => '' } as unknown as Response);
  const source = await resolveReportSource(params('src=https://x/run.ndjson&key=runs/1.ndjson'), {
    resolveSource: async (p) => ({ url: p.get('key')!, fetch: customFetch }),
  });
  assert.strictEqual(source!.url, 'runs/1.ndjson');
  assert.strictEqual(source!.fetch, customFetch);
});

test('a nullish resolver result falls through to the default ?src= handling', async () => {
  const source = await resolveReportSource(params('src=https://x/run.ndjson'), {
    resolveSource: async () => null,
  });
  assert.deepStrictEqual(source, { url: 'https://x/run.ndjson', fetch: undefined, pollMs: DEFAULT_POLL_MS });
});

test('the resolver receives the page params', async () => {
  let seen: string | null = null;
  await resolveReportSource(params('key=runs/1.ndjson'), {
    resolveSource: async (p) => { seen = p.get('key'); return null; },
  });
  assert.strictEqual(seen, 'runs/1.ndjson');
});

test('the source pollMs override beats ?poll=', async () => {
  const source = await resolveReportSource(params('poll=250'), {
    resolveSource: async () => ({ url: 'runs/1.ndjson', pollMs: 5000 }),
  });
  assert.strictEqual(source!.pollMs, 5000);
});

test('a resolver source without pollMs falls back to ?poll=', async () => {
  const source = await resolveReportSource(params('poll=250'), {
    resolveSource: async () => ({ url: 'runs/1.ndjson' }),
  });
  assert.strictEqual(source!.pollMs, 250);
});

test('a resolver throw propagates to the caller', async () => {
  await assert.rejects(
    resolveReportSource(params('key=runs/1.ndjson'), {
      resolveSource: async () => { throw new Error('login denied'); },
    }),
    /login denied/,
  );
});
