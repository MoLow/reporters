import { test } from 'node:test';
import assert from 'node:assert';
import { remoteSink } from '../src/remote.ts';

const tick = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

test('flush uploads the accumulated buffer and viewerUrl passes through', async () => {
  const uploads: string[] = [];
  const sink = remoteSink({
    upload: async (body) => { uploads.push(body.toString()); },
    viewerUrl: () => 'https://viewer.example/?src=x',
  });
  sink.write('a');
  sink.write(Buffer.from('b'));
  await sink.flush!();
  assert.deepStrictEqual(uploads, ['ab']);
  assert.strictEqual(sink.viewerUrl!(), 'https://viewer.example/?src=x');
  await sink.close();
});

test('flush skips when nothing changed since the last upload', async () => {
  const uploads: string[] = [];
  const sink = remoteSink({
    upload: async (body) => { uploads.push(body.toString()); },
    viewerUrl: () => undefined,
  });
  sink.write('x');
  await sink.flush!();
  await sink.flush!();
  assert.deepStrictEqual(uploads, ['x']);
  await sink.close();
});

test('start runs setup, then the timer re-uploads as the buffer grows', async () => {
  const uploads: string[] = [];
  let started = false;
  const sink = remoteSink({
    start: async () => { started = true; },
    upload: async (body) => { uploads.push(body.toString()); },
    viewerUrl: () => undefined,
    flushMs: 20,
  });
  await sink.start!();
  assert.strictEqual(started, true);
  sink.write('live');
  await tick(60);
  assert.ok(uploads.includes('live'), `timer uploaded; got ${JSON.stringify(uploads)}`);
  await sink.close();
});

test('close clears the timer and does a final upload of unflushed bytes', async () => {
  const uploads: string[] = [];
  const sink = remoteSink({
    upload: async (body) => { uploads.push(body.toString()); },
    viewerUrl: () => undefined,
    flushMs: 60_000,
  });
  await sink.start!();
  sink.write('tail');
  await sink.close();
  assert.deepStrictEqual(uploads, ['tail']);
});

test('uploads never overlap; the final upload carries everything', async () => {
  let active = 0;
  let maxActive = 0;
  const uploads: string[] = [];
  const sink = remoteSink({
    upload: async (body) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await tick(40);
      uploads.push(body.toString());
      active -= 1;
    },
    viewerUrl: () => undefined,
    flushMs: 10,
  });
  await sink.start!();
  sink.write('one');
  await tick(25);
  sink.write('two');
  await sink.close();
  assert.strictEqual(maxActive, 1, 'no concurrent uploads');
  assert.strictEqual(uploads[uploads.length - 1], 'onetwo');
});

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

test('a failed upload backs off, then retries with the latest buffer', async () => {
  const uploads: string[] = [];
  let fail = true;
  const sink = remoteSink({
    upload: async (body) => {
      if (fail) throw new Error('net down');
      uploads.push(body.toString());
    },
    viewerUrl: () => undefined,
    flushMs: 60_000,
    backoffMs: 40,
  });
  sink.write('a');
  const err = await captureStderr(() => sink.flush!());
  assert.match(err, /upload failed \(net down\) — retrying in \d+s/);
  fail = false;
  sink.write('b');
  await sink.flush!();
  assert.deepStrictEqual(uploads, [], 'still inside the backoff window');
  await tick(60);
  await sink.flush!();
  assert.deepStrictEqual(uploads, ['ab'], 'one retry, carrying the latest buffer');
  await sink.close();
});

test('a server retryAfterMs stretches the backoff beyond the computed wait', async () => {
  let attempts = 0;
  const sink = remoteSink({
    upload: async () => {
      attempts += 1;
      const err: Error & { retryAfterMs?: number } = new Error('throttled');
      err.retryAfterMs = 200;
      throw err;
    },
    viewerUrl: () => undefined,
    flushMs: 60_000,
    backoffMs: 1,
  });
  sink.write('x');
  await captureStderr(() => sink.flush!());
  assert.strictEqual(attempts, 1);
  await tick(60);
  await sink.flush!();
  assert.strictEqual(attempts, 1, 'computed backoff elapsed, but retry-after still holds');
});

test('close waits out the backoff so the final state still lands', async () => {
  const uploads: string[] = [];
  let fail = true;
  const sink = remoteSink({
    upload: async (body) => {
      if (fail) throw new Error('blip');
      uploads.push(body.toString());
    },
    viewerUrl: () => undefined,
    flushMs: 60_000,
    backoffMs: 50,
  });
  sink.write('head');
  await captureStderr(() => sink.flush!());
  fail = false;
  sink.write('-tail');
  await sink.close();
  assert.deepStrictEqual(uploads, ['head-tail']);
});

test('a still-failing final upload leaves a missing-results notice', async () => {
  const sink = remoteSink({
    upload: async () => { throw new Error('down'); },
    viewerUrl: () => undefined,
    flushMs: 60_000,
    backoffMs: 10,
  });
  sink.write('x');
  const err = await captureStderr(async () => { await sink.flush!(); await sink.close(); });
  assert.match(err, /may be missing its final results/);
});
