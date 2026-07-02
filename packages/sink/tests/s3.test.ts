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
