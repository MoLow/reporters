import { resolvePollMs, type FetchLike } from './poll.ts';

export interface ReportSource {
  /** Passed to the NDJSON reader as the URL/identifier. */
  url: string;
  /** Transport for reads; defaults to the global fetch. Receives the reader's
   *  Range header and must return a standard Response. */
  fetch?: FetchLike;
  /** Poll cadence override; else resolved from ?poll= as today. */
  pollMs?: number;
}

export interface ViewerOptions {
  /** Called first with the page's query params. Return a source to use it;
   *  return null/undefined to fall through to the default ?src= handling.
   *  A never-resolving promise is legitimate (e.g. an auth redirect is in
   *  flight). A thrown error shows the viewer's load-error screen. */
  resolveSource?: (params: URLSearchParams) => Promise<ReportSource | null | undefined>;
}

export interface ResolvedSource {
  url: string;
  fetch?: FetchLike;
  pollMs: number;
}

export async function resolveReportSource(
  params: URLSearchParams,
  options: ViewerOptions = {},
): Promise<ResolvedSource | null> {
  const fallbackPollMs = resolvePollMs(params.get('poll'));
  if (options.resolveSource) {
    const source = await options.resolveSource(params);
    if (source) return { url: source.url, fetch: source.fetch, pollMs: source.pollMs ?? fallbackPollMs };
  }
  const src = params.get('src');
  if (!src) return null;
  return { url: src, fetch: undefined, pollMs: fallbackPollMs };
}
