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

/**
 * Well-known key under which a reporter function declares the options it wants
 * by default when driven through mux (a route's own `options` win key-by-key).
 * Lets a reporter behave differently under mux without env coupling — e.g.
 * `@reporters/web` declares `{ open: false }` so the sink owns viewing.
 */
export const MUX_DEFAULT_OPTIONS = Symbol.for('reporters.mux.defaultOptions');

function routeOptions(reporter: Reporter | Duplex, route: Route): unknown {
  const defaults = (reporter as { [MUX_DEFAULT_OPTIONS]?: object })[MUX_DEFAULT_OPTIONS];
  if (!defaults) return route.options;
  return { ...defaults, ...(route.options as object | undefined) };
}

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
  const sinks = routes.map((route) => resolveSink(route.sink));
  // Start every sink before any reporter consumes events, so a viewer-URL
  // getter wired into another route's options is live from the first event.
  const starts = sinks.map((sink) => sink.start?.());
  await Promise.allSettled(starts);
  const results = await Promise.allSettled(routes.map(async (route, i) => {
    const sink = sinks[i];
    try {
      await starts[i];
      const reporter = await resolveReporter(route.reporter);
      const stage = typeof reporter === 'function'
        ? (src: AsyncIterable<TestEvent>) => reporter(src, routeOptions(reporter, route))
        : reporter;
      const url = sink.viewerUrl?.();
      if (url) {
        internals.announce(url, env);
        if (shouldOpen(route.open, env)) open(url);
      }
      // `Readable#compose` drives both a generator-function reporter and a
      // Transform-stream reporter uniformly — the same primitive node:test uses
      // internally — handling backpressure and error propagation for us.
      const output = Readable.from(streams[i]).compose(stage) as unknown as AsyncIterable<string | Buffer>;
      for await (const chunk of output) await sink.write(chunk);
      if (sink.flush) await sink.flush();
    } finally {
      await sink.close();
    }
  }));
  const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failure) throw failure.reason;
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
