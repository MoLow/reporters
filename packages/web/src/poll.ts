import type { TestEvent } from '@reporters/tree-core';

export interface PullResult {
  events: TestEvent[];
  /** True when the source did not honor Range and was re-read in full; the
   *  caller should rebuild its store from scratch before applying `events`. */
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
 * Incrementally reads an append-only NDJSON stream over HTTP. Uses a Range
 * request to fetch only newly appended bytes; if the host ignores Range and
 * returns the whole body (200), it reports `reset` so the caller can rebuild.
 * A truncated trailing line is buffered until the next pull completes it.
 */
export function createNdjsonReader(url: string, fetchImpl: FetchLike = fetch) {
  let offset = 0;
  let buffer = '';

  async function pull(): Promise<PullResult> {
    const res = await fetchImpl(url, { headers: { Range: `bytes=${offset}-` } });
    if (res.status === 416) return { events: [], reset: false };

    const text = await res.text();
    let reset = false;
    if (res.status !== 206) {
      offset = 0;
      buffer = '';
      reset = true;
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
