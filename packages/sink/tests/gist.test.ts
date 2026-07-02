import { test } from 'node:test';
import assert from 'node:assert';
import { gist } from '../src/gist.ts';

interface Recorded { method: string; url: string; headers: Record<string, string>; body: any }

function fakeGithub() {
  const requests: Recorded[] = [];
  const fetchImpl = (async (url: unknown, init: any) => {
    requests.push({
      method: init.method, url: String(url), headers: init.headers, body: JSON.parse(init.body),
    });
    return {
      ok: true,
      status: init.method === 'POST' ? 201 : 200,
      json: async () => ({ id: 'abc123', owner: { login: 'molow' } }),
    };
  }) as unknown as typeof fetch;
  return { requests, fetchImpl };
}

/** Pin the gate-relevant env vars for one test; restores afterwards. */
function withEnv(t: { after: (fn: () => void) => void }, vars: Record<string, string | undefined>) {
  const saved = Object.keys(vars).map((key) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

async function captureStderr(fn: () => Promise<unknown> | unknown): Promise<string> {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = ((chunk: string | Buffer) => { captured += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    await fn();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

test('an explicit token enables the sink anywhere: creates a secret gist, sha-less raw viewer url', async (t) => {
  withEnv(t, { GITHUB_ACTIONS: undefined });
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ token: 't0k', fetchImpl });
  await sink.start!();
  const create = requests[0];
  assert.strictEqual(create.method, 'POST');
  assert.strictEqual(create.url, 'https://api.github.com/gists');
  assert.strictEqual(create.headers.authorization, 'Bearer t0k');
  assert.ok(create.headers['user-agent'], 'GitHub requires a user-agent');
  assert.strictEqual(create.body.public, false);
  assert.match(create.body.files['run.ndjson'].content, /\S/, 'the API 422s on empty or whitespace-only content');
  assert.doesNotThrow(() => JSON.parse(create.body.files['run.ndjson'].content), 'the seed must be a line the viewer can ignore');
  assert.strictEqual(
    sink.viewerUrl!(),
    `https://molow.github.io/reporters/?src=${encodeURIComponent('https://gist.githubusercontent.com/molow/abc123/raw/run.ndjson')}`,
  );
  await sink.close();
});

test('pollMs appends a poll param to the viewer url', async () => {
  const { fetchImpl } = fakeGithub();
  const sink = gist({ token: 't0k', fetchImpl, pollMs: 500 });
  await sink.start!();
  assert.match(sink.viewerUrl!()!, /&poll=500$/);
  await sink.close();
});

test('flush PATCHes the accumulated ndjson into the gist file', async () => {
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ token: 't0k', fetchImpl, filename: 'r.ndjson' });
  await sink.start!();
  sink.write('{"type":"test:pass"}\n');
  await sink.flush!();
  const patch = requests.find((r) => r.method === 'PATCH')!;
  assert.strictEqual(patch.url, 'https://api.github.com/gists/abc123');
  assert.strictEqual(patch.body.files['r.ndjson'].content, '{"type":"test:pass"}\n');
  await sink.close();
});

test('outside GitHub Actions (no explicit token) it errors to stderr and no-ops', async (t) => {
  withEnv(t, { GITHUB_ACTIONS: undefined, GITHUB_TOKEN: undefined, GH_TOKEN: undefined });
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ fetchImpl });
  const err = await captureStderr(() => sink.start!());
  assert.match(err, /only works on GitHub Actions/);
  sink.write('{"a":1}\n');
  await sink.flush!();
  await sink.close();
  assert.strictEqual(requests.length, 0, 'zero API calls when disabled');
  assert.strictEqual(sink.viewerUrl!(), undefined);
});

test('on GitHub Actions the env token is picked up', async (t) => {
  withEnv(t, { GITHUB_ACTIONS: 'true', GITHUB_TOKEN: 'envtok', GH_TOKEN: undefined });
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ fetchImpl });
  await sink.start!();
  assert.strictEqual(requests[0].headers.authorization, 'Bearer envtok');
  await sink.close();
});

test('on GitHub Actions without any token it errors to stderr and no-ops', async (t) => {
  withEnv(t, { GITHUB_ACTIONS: 'true', GITHUB_TOKEN: undefined, GH_TOKEN: undefined });
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ fetchImpl });
  const err = await captureStderr(() => sink.start!());
  assert.match(err, /needs a GitHub token/);
  await sink.flush!();
  await sink.close();
  assert.strictEqual(requests.length, 0);
  assert.strictEqual(sink.viewerUrl!(), undefined);
});

test('a failed gist creation disables the sink instead of failing the run', async () => {
  const fetchImpl = (async () => ({ ok: false, status: 403, json: async () => ({}) })) as unknown as typeof fetch;
  const sink = gist({ token: 'installation-token', fetchImpl });
  const err = await captureStderr(() => sink.start!());
  assert.match(err, /creating the gist failed/);
  assert.match(err, /403/);
  sink.write('{"a":1}\n');
  await sink.flush!();
  await sink.close();
  assert.strictEqual(sink.viewerUrl!(), undefined);
});

test('GH_TOKEN is used when GITHUB_TOKEN is absent', async (t) => {
  withEnv(t, { GITHUB_ACTIONS: 'true', GITHUB_TOKEN: undefined, GH_TOKEN: 'ghtok' });
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ fetchImpl });
  await sink.start!();
  assert.strictEqual(requests[0].headers.authorization, 'Bearer ghtok');
  await sink.close();
});

test('viewerUrl is undefined before start', () => {
  const sink = gist({ token: 't0k' });
  assert.strictEqual(sink.viewerUrl!(), undefined);
});

test('a throttled upload backs off (honoring Retry-After) and then retries', async () => {
  const requests: { method: string }[] = [];
  let throttle = true;
  const fetchImpl = (async (_url: unknown, init: any) => {
    requests.push({ method: init.method });
    if (init.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ id: 'g1', owner: { login: 'molow' } }) };
    }
    if (throttle) {
      return {
        ok: false,
        status: 403,
        headers: { get: (name: string) => (name === 'retry-after' ? '1' : null) },
        json: async () => ({}),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  }) as unknown as typeof fetch;

  const sink = gist({ token: 't0k', fetchImpl, flushMs: 30 });
  await sink.start!();
  sink.write('{"a":1}\n');
  const err = await captureStderr(() => sink.flush!());
  assert.match(err, /upload failed .*403.* — retrying in 1s/, 'the Retry-After second is the announced wait');
  sink.write('{"b":2}\n');
  await sink.flush!();
  assert.strictEqual(requests.filter((r) => r.method === 'PATCH').length, 1, 'held back while throttled');
  throttle = false;
  await new Promise((resolve) => { setTimeout(resolve, 1100); });
  await sink.flush!();
  assert.strictEqual(requests.filter((r) => r.method === 'PATCH').length, 2, 'retried after the server-instructed wait');
  await sink.close();
});
test('GH_TOKEN wins over GITHUB_TOKEN (Actions installs a useless GITHUB_TOKEN)', async (t) => {
  withEnv(t, { GITHUB_ACTIONS: 'true', GITHUB_TOKEN: 'installation', GH_TOKEN: 'pat' });
  const { requests, fetchImpl } = fakeGithub();
  const sink = gist({ fetchImpl });
  await sink.start!();
  assert.strictEqual(requests[0].headers.authorization, 'Bearer pat');
  await sink.close();
});

test('an API error surfaces the response body message', async () => {
  const fetchImpl = (async () => ({
    ok: false,
    status: 403,
    headers: { get: () => null },
    json: async () => ({ message: 'Resource protected by organization policy' }),
  })) as unknown as typeof fetch;
  const sink = gist({ token: 't0k', fetchImpl });
  const err = await captureStderr(() => sink.start!());
  assert.match(err, /403: Resource protected by organization policy/);
});
