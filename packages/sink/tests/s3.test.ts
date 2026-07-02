import { test } from 'node:test';
import assert from 'node:assert';
import { s3, internals, type Sdk } from '../src/s3.ts';

function fakeSdk() {
  const sent: { input: Record<string, unknown> }[] = [];
  const configs: Record<string, unknown>[] = [];
  class S3Client {
    config: unknown;

    constructor(config: Record<string, unknown>) { this.config = config; configs.push(config); }

    async send(command: { input: Record<string, unknown> }) { sent.push(command); }
  }
  class PutObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) { this.input = input; }
  }
  class GetObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) { this.input = input; }
  }
  const getSignedUrl = async (_client: unknown, command: { input: Record<string, unknown> }, options: { expiresIn: number }) => (
    `https://bucket.s3.example/${command.input.Key}?sig=abc&expires=${options.expiresIn}`
  );
  return { sent, configs, sdk: { S3Client, PutObjectCommand, GetObjectCommand, getSignedUrl } as unknown as Sdk };
}

function withFakeSdk(t: { after: (fn: () => void) => void }) {
  const fake = fakeSdk();
  const original = internals.loadSdk;
  internals.loadSdk = async () => fake.sdk;
  t.after(() => { internals.loadSdk = original; });
  return fake;
}

test('start signs a GET url; flush uploads the buffer via PutObject', async (t) => {
  const { sent } = withFakeSdk(t);
  const sink = s3({ bucket: 'ci-reports', key: 'runs/1.ndjson' });
  assert.strictEqual(sink.viewerUrl!(), undefined);
  await sink.start!();
  assert.strictEqual(
    sink.viewerUrl!(),
    `https://molow.github.io/reporters/?src=${encodeURIComponent('https://bucket.s3.example/runs/1.ndjson?sig=abc&expires=604800')}`,
  );
  sink.write('{"a":1}\n');
  await sink.flush!();
  const put = sent.find((c) => c.input.Body)!;
  assert.strictEqual(put.input.Bucket, 'ci-reports');
  assert.strictEqual(put.input.Key, 'runs/1.ndjson');
  assert.strictEqual(put.input.ContentType, 'application/x-ndjson');
  assert.strictEqual(String(put.input.Body), '{"a":1}\n');
  await sink.close();
});

test('the key defaults to the GitHub run id when present', async (t) => {
  withFakeSdk(t);
  const saved = process.env.GITHUB_RUN_ID;
  process.env.GITHUB_RUN_ID = '9876';
  t.after(() => {
    if (saved === undefined) delete process.env.GITHUB_RUN_ID; else process.env.GITHUB_RUN_ID = saved;
  });
  const sink = s3({ bucket: 'b' });
  await sink.start!();
  assert.match(sink.viewerUrl!()!, /reporters%2F9876\.ndjson/);
  await sink.close();
});

test('the key falls back to a uuid without a run id', async (t) => {
  withFakeSdk(t);
  const saved = process.env.GITHUB_RUN_ID;
  delete process.env.GITHUB_RUN_ID;
  t.after(() => { if (saved !== undefined) process.env.GITHUB_RUN_ID = saved; });
  const sink = s3({ bucket: 'b' });
  await sink.start!();
  assert.match(decodeURIComponent(sink.viewerUrl!()!), /reporters\/[0-9a-f]{8}-[0-9a-f-]{27}\.ndjson/);
  await sink.close();
});

test('expiresIn and viewerBase are honored', async (t) => {
  withFakeSdk(t);
  const sink = s3({
    bucket: 'b', key: 'k.ndjson', expiresIn: 60, viewerBase: 'https://viewer.example/',
  });
  await sink.start!();
  assert.strictEqual(
    sink.viewerUrl!(),
    `https://viewer.example/?src=${encodeURIComponent('https://bucket.s3.example/k.ndjson?sig=abc&expires=60')}`,
  );
  await sink.close();
});

test('pollMs appends a poll param to the viewer url', async (t) => {
  withFakeSdk(t);
  const sink = s3({ bucket: 'b', key: 'k.ndjson', pollMs: 500 });
  await sink.start!();
  assert.match(sink.viewerUrl!()!, /&poll=500$/);
  await sink.close();
});

test('the default loadSdk resolves the real AWS SDK (installed as a dev dependency)', async () => {
  const sdk = await internals.loadSdk();
  assert.strictEqual(typeof sdk.S3Client, 'function');
  assert.strictEqual(typeof sdk.PutObjectCommand, 'function');
  assert.strictEqual(typeof sdk.GetObjectCommand, 'function');
  assert.strictEqual(typeof sdk.getSignedUrl, 'function');
});

test('region, endpoint and credentials are passed through to the client', async (t) => {
  const { configs } = withFakeSdk(t);
  const credentials = { accessKeyId: 'ak', secretAccessKey: 'sk' };
  const sink = s3({
    bucket: 'b', key: 'k.ndjson', region: 'eu-west-1', endpoint: 'https://minio.example', credentials,
  });
  await sink.start!();
  assert.deepStrictEqual(configs[0], { region: 'eu-west-1', endpoint: 'https://minio.example', credentials });
  await sink.close();
});

test('a failed upload never throws; it backs off and retries with the latest buffer', async (t) => {
  const fake = fakeSdk();
  let fail = true;
  const bodies: string[] = [];
  fake.sdk.S3Client.prototype.send = async (command: { input: Record<string, unknown> }) => {
    if (fail) throw new Error('AccessDenied');
    bodies.push(String(command.input.Body));
  };
  const original = internals.loadSdk;
  internals.loadSdk = async () => fake.sdk;
  t.after(() => { internals.loadSdk = original; });

  const sink = s3({ bucket: 'b', key: 'k.ndjson', flushMs: 30 });
  await sink.start!();
  sink.write('{"a":1}\n');
  const originalWrite = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = ((chunk: string | Buffer) => { captured += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    await sink.flush!();
    fail = false;
    sink.write('{"b":2}\n');
    await sink.close();
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.match(captured, /upload failed \(AccessDenied\) — retrying/);
  assert.deepStrictEqual(bodies, ['{"a":1}\n{"b":2}\n'], 'the retry carries the latest buffer');
});

test('a viewerUrl callback overrides the link and receives the full context', async (t) => {
  withFakeSdk(t);
  let ctx: unknown;
  const sink = s3({
    bucket: 'ci-reports',
    key: 'runs/1.ndjson',
    pollMs: 500,
    viewerBase: 'https://viewer.example/',
    viewerUrl: (c) => { ctx = c; return `https://viewer.example/?key=${encodeURIComponent(c.key)}`; },
  });
  await sink.start!();
  assert.strictEqual(sink.viewerUrl!(), 'https://viewer.example/?key=runs%2F1.ndjson');
  assert.deepStrictEqual(ctx, {
    key: 'runs/1.ndjson',
    bucket: 'ci-reports',
    presignedUrl: 'https://bucket.s3.example/runs/1.ndjson?sig=abc&expires=604800',
    viewerBase: 'https://viewer.example/',
    pollMs: 500,
  });
  await sink.close();
});

test('viewerUrl callback context defaults viewerBase and omits pollMs when unset', async (t) => {
  withFakeSdk(t);
  let ctx: { viewerBase: string; pollMs?: number } | undefined;
  const sink = s3({
    bucket: 'b',
    key: 'k.ndjson',
    viewerUrl: (c) => { ctx = c; return undefined; },
  });
  await sink.start!();
  assert.strictEqual(sink.viewerUrl!(), undefined);
  assert.strictEqual(ctx!.viewerBase, 'https://molow.github.io/reporters/');
  assert.strictEqual(ctx!.pollMs, undefined);
  await sink.close();
});

test('the viewerUrl callback is not called before start signs the url', async (t) => {
  withFakeSdk(t);
  let called = false;
  const sink = s3({ bucket: 'b', key: 'k.ndjson', viewerUrl: () => { called = true; return 'x'; } });
  assert.strictEqual(sink.viewerUrl!(), undefined);
  assert.strictEqual(called, false);
  await sink.close();
});
