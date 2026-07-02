import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

export interface Sink {
  /** Start servers/streams; resolves once ready to receive writes. */
  start?(): Promise<void>;
  write(chunk: string | Buffer): void | Promise<void>;
  /** Periodic durability hook (e.g. a future s3 re-PUT). */
  flush?(): Promise<void>;
  /** The run ended; release resources. */
  close(): Promise<void>;
  /**
   * How a human views what was written, if anything. Valid once `start()` has
   * resolved; under mux, every sink in the profile has started before any
   * reporter receives events, so a getter wired into another route's
   * `options` is live from the first event.
   */
  viewerUrl?(): string | undefined;
}

export type SinkSpec = string | Sink;

/** Wrap a writable stream (stdout/stderr). Never closes the underlying stream. */
export function streamSink(stream: NodeJS.WritableStream): Sink {
  return {
    write(chunk) { stream.write(chunk); },
    async close() { /* leave shared streams open */ },
  };
}

/** Append bytes to a file. No viewer URL: raw NDJSON is not directly viewable. */
export function fileSink(path: string): Sink {
  const full = resolve(path);
  let stream: ReturnType<typeof createWriteStream> | undefined;
  return {
    async start() { stream = createWriteStream(full); },
    write(chunk) { (stream ?? (stream = createWriteStream(full))).write(chunk); },
    async close() {
      const s = stream;
      if (!s) return;
      await new Promise<void>((res, rej) => {
        s.end((err?: Error | null) => {
          /* c8 ignore next -- a file end error isn't triggerable in a unit test */
          if (err) return rej(err);
          return res();
        });
      });
    },
  };
}

export function resolveSink(spec: SinkSpec): Sink {
  if (typeof spec !== 'string') return spec;
  if (spec === 'stdout') return streamSink(process.stdout);
  if (spec === 'stderr') return streamSink(process.stderr);
  return fileSink(spec);
}
