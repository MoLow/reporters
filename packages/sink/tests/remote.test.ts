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

test('a failed upload re-marks the buffer dirty so the next flush retries', async () => {
  const uploads: string[] = [];
  let fail = true;
  const sink = remoteSink({
    upload: async (body) => {
      if (fail) throw new Error('net down');
      uploads.push(body.toString());
    },
    viewerUrl: () => undefined,
  });
  sink.write('data');
  await assert.rejects(() => sink.flush!(), /net down/);
  fail = false;
  await sink.flush!();
  assert.deepStrictEqual(uploads, ['data']);
  await sink.close();
});
