import { Readable } from 'node:stream';
import type { Duplex } from 'node:stream';
import type { TestEvent } from '@reporters/tree-core';
import type { MuxConfig, Reporter, Route } from './types.ts';
import { loadConfig } from './config.ts';
import { resolveProfile } from './profile.ts';
import { broadcast } from './broadcast.ts';
import { resolveSink } from './sink.ts';
import type { Sink } from './sink.ts';
import { shouldOpen, internals } from './open.ts';

export type { Sink, SinkSpec } from './sink.ts';
export type { Reporter, Route, MuxConfig } from './types.ts';

function isStreamReporter(value: unknown): value is Duplex {
  return typeof value === 'object' && value !== null
    && typeof (value as { pipe?: unknown }).pipe === 'function';
}

/** A reporter function, a stream instance, or a module specifier to `import()`. */
export async function resolveReporter(reporter: Reporter | Duplex | string): Promise<Reporter | Duplex> {
  if (typeof reporter === 'function' || isStreamReporter(reporter)) return reporter;
  const mod = await import(reporter);
  const resolved = mod.default as unknown;
  if (typeof resolved === 'function' || isStreamReporter(resolved)) return resolved as Reporter | Duplex;
  throw new Error(`mux: reporter "${reporter}" must default-export a generator function or a stream`);
}

/**
 * Run every route in `config`'s active profile against `source`: tee the events,
 * run each route's reporter, pipe its bytes into the route's sink, and open the
 * sink's viewer URL when the gate allows. `open` is injected for testability.
 */
export async function runRoutes(
  source: AsyncIterable<TestEvent>,
  config: MuxConfig,
  env: NodeJS.ProcessEnv = process.env,
  open: (url: string) => void = internals.openInBrowser,
): Promise<void> {
  const routes: Route[] = resolveProfile(config, env);
  const streams = broadcast(source, routes.length);
  await Promise.all(routes.map(async (route, i) => {
    const reporter = await resolveReporter(route.reporter);
    const sink = resolveSink(route.sink);
    if (sink.start) await sink.start();
    if (sink.viewerUrl && shouldOpen(route.open, env)) {
      const url = sink.viewerUrl();
      if (url) open(url);
    }
    // `Readable#compose` drives both a generator-function reporter and a
    // Transform-stream reporter uniformly — the same primitive node:test uses
    // internally — handling backpressure and error propagation for us.
    const stage = typeof reporter === 'function'
      ? (src: AsyncIterable<TestEvent>) => reporter(src, route.options)
      : reporter;
    const output = Readable.from(streams[i]).compose(stage) as unknown as AsyncIterable<string | Buffer>;
    try {
      for await (const chunk of output) await sink.write(chunk);
      if (sink.flush) await sink.flush();
    } finally {
      await sink.close();
    }
  }));
}

/**
 * The routing reporter. Reads `mux.config`, resolves the active profile, and
 * fans the event stream out to each route's reporter + sink. It yields nothing
 * to Node — all output flows through the sinks it drives directly.
 */
export default async function* mux(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const config = await loadConfig();
  await runRoutes(source, config);
}
