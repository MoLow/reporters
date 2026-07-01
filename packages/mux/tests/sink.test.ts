import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { streamSink, fileSink, resolveSink } from '../src/sink.ts';

test('streamSink writes chunks to the underlying stream', () => {
  const written: string[] = [];
  const fake = { write: (c: string | Buffer) => { written.push(String(c)); return true; } } as unknown as NodeJS.WritableStream;
  const sink = streamSink(fake);
  sink.write('a');
  sink.write('b');
  assert.deepStrictEqual(written, ['a', 'b']);
});

test('fileSink writes buffered bytes to disk on start/write/close', async () => {
  const path = join(tmpdir(), `mux-filesink-${process.pid}.ndjson`);
  const sink = fileSink(path);
  await sink.start!();
  await Promise.resolve(sink.write('line-1\n'));
  await Promise.resolve(sink.write('line-2\n'));
  await sink.close();
  assert.strictEqual(readFileSync(path, 'utf8'), 'line-1\nline-2\n');
  rmSync(path, { force: true });
});

test('resolveSink maps string shorthands', () => {
  // verify that resolveSink('stdout') delegates to process.stdout
  const captured: Array<string | Buffer> = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Buffer) => {
    captured.push(chunk);
    return true;
  }) as any;
  try {
    const stdoutSink = resolveSink('stdout');
    stdoutSink.write('test-chunk');
    assert.deepStrictEqual(captured, ['test-chunk']);
  } finally {
    process.stdout.write = originalWrite;
  }

  // a non-string spec is returned as-is
  const custom = { write() {}, async close() {} };
  assert.strictEqual(resolveSink(custom), custom);

  // resolveSink with file path returns a sink with start method (file-path branch)
  assert.strictEqual(typeof resolveSink('some/path.ndjson').start, 'function');
});

test('resolveSink("stderr") delegates to process.stderr', () => {
  const captured: Array<string | Buffer> = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Buffer) => { captured.push(chunk); return true; }) as typeof process.stderr.write;
  try {
    resolveSink('stderr').write('to-stderr');
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.deepStrictEqual(captured, ['to-stderr']);
});

test('streamSink.close() is a no-op that leaves the stream open', async () => {
  let ended = false;
  const fake = {
    write: () => true,
    end: () => { ended = true; },
  } as unknown as NodeJS.WritableStream;
  await streamSink(fake).close();
  assert.strictEqual(ended, false);
});

test('fileSink writes without an explicit start(); close() before any write is a no-op', async () => {
  const path = join(tmpdir(), `mux-filesink-lazy-${process.pid}.ndjson`);
  const lazy = fileSink(path);
  await Promise.resolve(lazy.write('lazy\n')); // creates the stream on first write
  await lazy.close();
  assert.strictEqual(readFileSync(path, 'utf8'), 'lazy\n');
  rmSync(path, { force: true });

  // close() before start()/write() has no stream to end — must not throw.
  await fileSink(join(tmpdir(), `mux-filesink-unused-${process.pid}.ndjson`)).close();
});
