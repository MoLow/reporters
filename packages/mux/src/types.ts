import type { Duplex } from 'node:stream';
import type { TestEvent } from '@reporters/tree-core';
import type { Sink, SinkSpec } from './sink.ts';

export type { Sink, SinkSpec } from './sink.ts';

/** A `node:test` reporter: pure transform from events to output bytes. */
export type Reporter = (
  source: AsyncIterable<TestEvent>,
  options?: unknown,
) => AsyncGenerator<string>;

export interface Route {
  /** A reporter: a generator function, a Duplex/Transform stream instance, or a
   *  module specifier `mux` will `import()` to either shape. */
  reporter: Reporter | Duplex | string;
  /** Optional 2nd-arg passed to the reporter (only for output-format variants). */
  options?: unknown;
  /** Where the reporter's bytes go: 'stdout' | 'stderr' | a file path | a Sink. */
  sink: SinkSpec;
  /** Open the sink's viewer URL in a browser. Defaults to on locally, off in CI. */
  open?: boolean;
}

/** Map of profile name -> the routes active under that profile. */
export type MuxConfig = Record<string, Route[]>;
