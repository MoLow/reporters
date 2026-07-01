import { serializeWireLine, type TestEvent } from '@reporters/tree-core';
import { startViewerServer, type ViewerServer } from './server.ts';
import { soleFileDestination, shouldOpen, internals } from './open.ts';

export interface WebOptions {
  /** Serve a live browser view of the run and open it. Defaults to detecting an
   *  interactive terminal (a TTY, not CI); `REPORTERS_WEB_OPEN=1|0` also overrides. */
  open?: boolean;
}

function hint(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * A `node:test` reporter that emits the run as a raw NDJSON event log — one
 * JSON-safe wire line per event — to whatever `--test-reporter-destination`
 * points at.
 *
 * Run standalone on a dev machine it also serves a live browser view and opens
 * it, the same way it behaves through `@reporters/mux`'s `httpServer()` sink.
 * Control this with the `open` option or `REPORTERS_WEB_OPEN=1|0`; it never opens
 * in CI by default. Through mux the reporter is a pure emitter and the sink owns
 * viewing.
 */
export default async function* web(
  source: AsyncIterable<TestEvent>,
  options: WebOptions = {},
): AsyncGenerator<string> {
  const dest = soleFileDestination();
  const serve = shouldOpen(options.open);

  let server: ViewerServer | undefined;
  if (serve) {
    server = await startViewerServer();
    internals.openInBrowser(server.url);
    hint(`\n@reporters/web: live report at ${server.url}`);
  }

  for await (const event of source) {
    const line = serializeWireLine(event);
    server?.push(line);
    // Emit to the destination as usual. When serving with no file destination
    // (a live terminal view) skip stdout so the browser is the only view.
    if (dest || !server) yield line;
  }

  if (!server) return;
  /* c8 ignore next -- interactive keep-alive isn't unit-testable */
  if (process.stdin.isTTY) return; // keep serving for review; user quits with Ctrl+C
  await server.close();
}
