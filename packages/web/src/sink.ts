import type { Sink } from '@reporters/mux';
import { startViewerServer, type ViewerServer } from './server.ts';

export interface HttpServerOptions {
  host?: string;
}

/**
 * A sink that serves the run locally: the viewer page at `/` and the growing
 * NDJSON at `/run.ndjson` (HTTP Range aware, so the viewer polls appended bytes
 * — no `file://`/CORS limits). Stays alive after the run while attached to an
 * interactive terminal; otherwise shuts down so the process can exit.
 */
export function httpServer(opts: HttpServerOptions = {}): Sink {
  let server: ViewerServer | undefined;
  return {
    async start() { server = await startViewerServer(opts.host); },
    write(chunk) { server?.push(chunk); },
    viewerUrl() { return server?.url; },
    async close() {
      // Keep serving for review when attached to an interactive terminal (the
      // user quits with Ctrl+C); otherwise shut down so the process exits.
      /* c8 ignore next -- interactive keep-alive isn't unit-testable */
      if (process.stdin.isTTY) return;
      await server?.close();
    },
  };
}
