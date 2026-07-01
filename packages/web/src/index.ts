import { serializeWireLine, type TestEvent } from '@reporters/tree-core';

/**
 * A `node:test` reporter that emits the run as a raw NDJSON event log — one
 * JSON-safe wire line per event. It is a pure transform: it writes to whatever
 * `--test-reporter-destination` points at and knows nothing about viewing.
 *
 * To view a run, route it through `@reporters/mux` with the `httpServer()` sink
 * (from `@reporters/web/sink`), or host the NDJSON and open the hosted viewer at
 * https://molow.github.io/reporters/?src=<url-to-the-ndjson>.
 */
export default async function* web(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  for await (const event of source) yield serializeWireLine(event);
}
