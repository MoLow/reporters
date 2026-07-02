import type { Sink } from '@reporters/mux';

export interface RemoteSinkOptions {
  /** One-time setup before any upload (create the gist / sign the GET url). */
  start?: () => Promise<void>;
  /** Re-upload the full growing buffer. Called on a timer and once at the end. */
  upload: (body: Buffer) => Promise<void>;
  /** The hosted-viewer URL, already `?src=<encoded>`; valid after `start`. */
  viewerUrl: () => string | undefined;
  /** Periodic re-upload cadence in ms (default 2000). */
  flushMs?: number;
}

/**
 * The engine the delivery sinks build on: buffers writes in memory and
 * re-uploads the whole buffer live-ish — on a timer while the run streams, and
 * once more on close so the last bytes always land. Uploads are coalesced:
 * never more than one in flight, and only when the buffer changed.
 */
export function remoteSink(opts: RemoteSinkOptions): Sink {
  let buffer = Buffer.alloc(0);
  let dirty = false;
  let inflight: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function uploadNow(): Promise<void> {
    if (!dirty || inflight) return;
    dirty = false;
    inflight = opts.upload(buffer);
    try {
      await inflight;
    } catch (err) {
      dirty = true;
      throw err;
    } finally {
      inflight = undefined;
    }
  }

  return {
    async start() {
      await opts.start?.();
      timer = setInterval(() => { uploadNow().catch(() => { /* retried next tick / on close */ }); }, opts.flushMs ?? 2000);
      timer.unref?.();
    },
    write(chunk) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      dirty = true;
    },
    async flush() {
      await uploadNow();
    },
    async close() {
      if (timer) clearInterval(timer);
      if (inflight) await inflight.catch(() => { /* the final upload below retries */ });
      await uploadNow();
    },
    viewerUrl() {
      return opts.viewerUrl();
    },
  };
}
