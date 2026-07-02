import { test } from 'node:test';
import assert from 'node:assert';
import { httpServer } from '../src/sink.ts';

function baseOf(sink: ReturnType<typeof httpServer>) {
  return sink.viewerUrl!()!.replace('/?src=/run.ndjson&poll=250', '');
}

test('viewerUrl points at the local server with the run.ndjson src and a fast poll', async () => {
  const sink = httpServer({ host: '127.0.0.1' });
  await sink.start!();
  try {
    assert.match(sink.viewerUrl!()!, /^http:\/\/127\.0\.0\.1:\d+\/\?src=\/run\.ndjson&poll=250$/);
  } finally {
    // stdin isn't a TTY under `node --test`, so close() shuts the server.
    await sink.close();
  }
});

test('serves the viewer page at / and NDJSON at /run.ndjson', async () => {
  const sink = httpServer();
  await sink.start!();
  try {
    sink.write('{"type":"test:pass"}\n');
    sink.write(Buffer.from('{"type":"test:fail"}\n')); // Buffer chunks are appended too
    const base = baseOf(sink);
    const page = await fetch(`${base}/`);
    assert.match(await page.text(), /<!doctype html>/i);
    const log = await fetch(`${base}/run.ndjson`);
    assert.strictEqual((await log.text()).trim(), '{"type":"test:pass"}\n{"type":"test:fail"}');
  } finally {
    await sink.close();
  }
});

test('close() before start() is a no-op (no server to shut down)', async () => {
  await httpServer().close();
});

test('honors HTTP Range for appended bytes', async () => {
  const sink = httpServer();
  await sink.start!();
  try {
    const base = baseOf(sink);
    sink.write('aaa\n'); // 4 bytes
    const res = await fetch(`${base}/run.ndjson`, { headers: { Range: 'bytes=4-' } });
    assert.strictEqual(res.status, 416); // nothing appended past offset 4 yet
    sink.write('bbb\n');
    const res2 = await fetch(`${base}/run.ndjson`, { headers: { Range: 'bytes=4-' } });
    assert.strictEqual(res2.status, 206);
    assert.strictEqual(await res2.text(), 'bbb\n');
  } finally {
    await sink.close();
  }
});
