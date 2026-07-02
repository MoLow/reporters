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
  /** First-retry delay after a failed upload, doubling per consecutive
   *  failure (default: the flush cadence). */
  backoffMs?: number;
  /** Ceiling for the computed backoff (default 60s). */
  maxBackoffMs?: number;
}

/** Throw one of these from `upload` to have the engine wait at least the
 *  server-instructed time (e.g. a Retry-After header) before retrying. */
export interface UploadError extends Error {
  retryAfterMs?: number;
}

/**
 * The engine the delivery sinks build on: buffers writes in memory and
 * re-uploads the whole buffer live-ish — on a timer while the run streams, and
 * once more on close so the last bytes always land. Uploads are coalesced:
 * never more than one in flight, only when the buffer changed, and always the
 * CURRENT buffer — so a retry after a failure skips the stale intermediate
 * states and delivers the latest. Delivery is best-effort: a failed upload
 * never throws; the engine slows down (exponential backoff, honoring a
 * server-provided retryAfterMs) and tries again.
 */
export function remoteSink(opts: RemoteSinkOptions): Sink {
  const flushMs = opts.flushMs ?? 2000;
  const backoffMs = opts.backoffMs ?? flushMs;
  const maxBackoffMs = opts.maxBackoffMs ?? 60_000;
  let buffer = Buffer.alloc(0);
  let dirty = false;
  let inflight: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let failures = 0;
  let backoffUntil = 0;

  async function uploadNow(): Promise<void> {
    if (!dirty || inflight || Date.now() < backoffUntil) return;
    dirty = false;
    inflight = opts.upload(buffer);
    try {
      await inflight;
      failures = 0;
      backoffUntil = 0;
    } catch (err) {
      dirty = true;
      failures += 1;
      const computed = Math.min(backoffMs * 2 ** (failures - 1), maxBackoffMs);
      const wait = Math.max((err as UploadError).retryAfterMs ?? 0, computed);
      backoffUntil = Date.now() + wait;
      process.stderr.write(`\n@reporters/sink: upload failed (${(err as Error).message}) — retrying in ${Math.ceil(wait / 1000)}s\n`);
    } finally {
      inflight = undefined;
    }
  }

  return {
    async start() {
      await opts.start?.();
      timer = setInterval(() => { uploadNow().catch(() => { /* uploadNow never rejects */ }); }, flushMs);
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
      // Wait out any remaining backoff so the report's final state still
      // lands; the wait satisfied it, so clear the gate (timers can fire a
      // hair early relative to Date.now()).
      const remaining = backoffUntil - Date.now();
      if (dirty && remaining > 0) await new Promise((resolve) => { setTimeout(resolve, remaining); });
      backoffUntil = 0;
      await uploadNow();
      if (dirty) process.stderr.write('\n@reporters/sink: the report may be missing its final results\n');
    },
    viewerUrl() {
      return opts.viewerUrl();
    },
  };
}
