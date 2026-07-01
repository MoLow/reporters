import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The built viewer page (React app inlined), assembled by tsup's onSuccess. */
function viewerPage(): string {
  try {
    return readFileSync(fileURLToPath(new URL('./viewer/index.html', import.meta.url)), 'utf8');
  /* c8 ignore start -- fallback only when the build artifact is missing */
  } catch {
    return '<!doctype html><meta charset="utf-8"><p>viewer bundle missing — run the package build</p>';
  }
  /* c8 ignore stop */
}

/** A running local viewer server over a growing in-memory NDJSON buffer. */
export interface ViewerServer {
  /** The viewer URL, pre-pointed at this server's `/run.ndjson`. */
  readonly url: string;
  /** Append NDJSON bytes; served to the viewer via HTTP Range polling. */
  push(chunk: string | Buffer): void;
  /** Shut the server down. */
  close(): Promise<void>;
}

/**
 * Start a local HTTP server that serves the viewer page at `/` and a growing
 * NDJSON log at `/run.ndjson` with HTTP Range support, so the browser viewer
 * live-updates as bytes are appended — no `file://`/CORS limits. Shared by the
 * `httpServer()` sink and the standalone reporter.
 */
export function startViewerServer(host = '127.0.0.1'): Promise<ViewerServer> {
  const page = viewerPage();
  let buffer = Buffer.alloc(0);

  return new Promise<ViewerServer>((resolve) => {
    const server: Server = createServer((req, res) => {
      const path = req.url!.split('?')[0];
      if (path === '/run.ndjson') {
        const range = /^bytes=(\d+)-/.exec(req.headers.range ?? '');
        if (range) {
          const startByte = Number(range[1]);
          if (startByte >= buffer.length) { res.writeHead(416).end(); return; }
          res.writeHead(206, {
            'content-type': 'application/x-ndjson',
            'accept-ranges': 'bytes',
            'content-range': `bytes ${startByte}-${buffer.length - 1}/${buffer.length}`,
          });
          res.end(buffer.subarray(startByte));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/x-ndjson', 'accept-ranges': 'bytes' });
        res.end(buffer);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
    });

    server.listen(0, host, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://${host}:${port}/?src=/run.ndjson`,
        push(chunk) {
          buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
        },
        close() {
          return new Promise<void>((res) => { server.close(() => res()); });
        },
      });
    });
  });
}
