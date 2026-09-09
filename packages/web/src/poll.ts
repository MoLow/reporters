import type { TestEvent } from '@reporters/tree-core';

export interface PullResult {
  events: TestEvent[];
  /** True when a read that asked for a Range got the whole body back, so
   *  `events` repeats what was already applied; the caller should rebuild its
   *  store from scratch before applying them. The unranged first read of a
   *  stream has nothing to rebuild and never sets it. */
  reset: boolean;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export const DEFAULT_POLL_MS = 1000;
const MIN_POLL_MS = 100;
const MAX_POLL_MS = 10_000;

/**
 * Resolves the viewer's poll cadence from the `poll` query param. Sinks that
 * build the viewer URL declare their own cadence (the local HTTP server asks
 * for a fast poll; remote hosts like S3/gist omit it and get the default).
 * Clamped so a hand-crafted URL can't hammer a host or stall the viewer.
 */
export function resolvePollMs(value: string | null): number {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_POLL_MS;
  return Math.min(MAX_POLL_MS, Math.max(MIN_POLL_MS, ms));
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Incrementally reads an append-only NDJSON stream over HTTP. Reads the stream
 * whole once, then Ranges from the offset reached to fetch only newly appended
 * bytes; if the host ignores Range and returns the whole body (200), it reports
 * `reset` so the caller can rebuild. A truncated trailing line is buffered
 * until the next pull completes it.
 */
export function createNdjsonReader(url: string, fetchImpl: FetchLike = fetch) {
  let offset = 0;
  let buffer = '';

  async function pull(): Promise<PullResult> {
    // Only a non-zero offset is worth a Range: a browser drops `Accept-Encoding` to `identity` on
    // any ranged request, so asking for `bytes=0-` forfeits compression and pulls the whole stream
    // raw - on a multi-megabyte NDJSON report that is an order of magnitude more bytes than a 200.
    const ranged = offset > 0;
    const res = await fetchImpl(url, ranged ? { headers: { Range: `bytes=${offset}-` } } : {});
    if (res.status === 416) return { events: [], reset: false };

    const text = await res.text();
    let reset = false;
    if (res.status !== 206) {
      reset = ranged;
      offset = 0;
      buffer = '';
    }
    offset += byteLength(text);
    buffer += text;

    const lines = buffer.split('\n');
    /* c8 ignore next */
    buffer = lines.pop() ?? '';
    const events: TestEvent[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as TestEvent);
      } catch {
        // ignore malformed lines
      }
    }
    return { events, reset };
  }

  return { pull };
}
