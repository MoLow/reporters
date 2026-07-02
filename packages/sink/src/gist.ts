import type { Sink } from '@reporters/mux';
import { remoteSink, type UploadError } from './remote.ts';

const API = 'https://api.github.com';
const DEFAULT_VIEWER = 'https://molow.github.io/reporters/';

export interface GistOptions {
  /** Defaults to `GITHUB_TOKEN` / `GH_TOKEN`; passing one explicitly also
   *  enables the sink outside GitHub Actions. */
  token?: string;
  /** Create a public gist (default: secret). */
  public?: boolean;
  filename?: string;
  description?: string;
  viewerBase?: string;
  flushMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Uploads the run's NDJSON to a GitHub gist. Needs a gist-scoped PAT (the
 * Actions-installed GITHUB_TOKEN cannot create gists). Delivery is best-effort
 * and only active on GitHub Actions — outside Actions (unless a token is
 * passed explicitly), without a token, or when creation fails, it prints one
 * stderr error and does nothing else: configs are evaluated eagerly for every
 * profile, so this must never break a run. The viewer polls the sha-less raw
 * URL, which always serves the latest revision.
 */
export function gist(opts: GistOptions = {}): Sink {
  const filename = opts.filename ?? 'run.ndjson';
  const fetchImpl = opts.fetchImpl ?? fetch;
  let disabled = false;
  let token: string | undefined;
  let id: string | undefined;
  let rawUrl: string | undefined;

  async function request(method: string, path: string, body: unknown): Promise<{ id: string; owner: { login: string } }> {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': '@reporters/sink',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Surface the API's own explanation — a bare status can't distinguish a
      // rate limit from a permissions or abuse-detection rejection.
      const detail = await res.json().then((data: { message?: string }) => (data?.message ? `: ${data.message}` : ''), () => '');
      const err: UploadError = new Error(`gist ${method} ${path} failed with ${res.status}${detail}`);
      // Secondary rate limits come with a Retry-After (seconds); pass it to
      // the engine so retries pace themselves to the server's instruction.
      const retryAfter = Number(res.headers?.get?.('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) err.retryAfterMs = retryAfter * 1000;
      throw err;
    }
    return res.json() as Promise<{ id: string; owner: { login: string } }>;
  }

  return remoteSink({
    // Every upload is a gist revision (a git commit), so default to a gentler
    // cadence than the engine's 2s — it also keeps secondary rate limits away.
    flushMs: opts.flushMs ?? 10_000,
    async start() {
      if (!opts.token && process.env.GITHUB_ACTIONS !== 'true') {
        disabled = true;
        process.stderr.write('\n@reporters/sink: the gist sink only works on GitHub Actions (pass a token to use it elsewhere) — skipping\n');
        return;
      }
      token = opts.token ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
      if (!token) {
        disabled = true;
        process.stderr.write('\n@reporters/sink: gist sink needs a GitHub token (GITHUB_TOKEN / GH_TOKEN or the token option) — skipping\n');
        return;
      }
      try {
        const created = await request('POST', '/gists', {
          public: opts.public ?? false,
          description: opts.description ?? 'node:test run — @reporters/web',
          // The API 422s on empty AND whitespace-only file content; seed with a
          // benign JSON line the viewer ignores (replaced by the first upload).
          files: { [filename]: { content: '{}\n' } },
        });
        id = created.id;
        // The response's raw_url is pinned to a commit sha; the sha-less form
        // always serves the latest revision, which is what the viewer polls.
        rawUrl = `https://gist.githubusercontent.com/${created.owner.login}/${created.id}/raw/${filename}`;
      } catch (err) {
        // Delivering the report is best-effort — a failed creation (e.g. a
        // token without the gist scope) must not fail the test run.
        disabled = true;
        process.stderr.write(`\n@reporters/sink: creating the gist failed (${(err as Error).message}) — skipping\n`);
      }
    },
    async upload(body) {
      if (disabled) return;
      await request('PATCH', `/gists/${id}`, { files: { [filename]: { content: body.toString('utf8') } } });
    },
    viewerUrl() {
      if (!rawUrl) return undefined;
      return `${opts.viewerBase ?? DEFAULT_VIEWER}?src=${encodeURIComponent(rawUrl)}`;
    },
  });
}
