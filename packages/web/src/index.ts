import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { serializeWireLine, type TestEvent } from '@reporters/tree-core';
import { htmlHeader, HTML_FOOTER, safeEventLine } from './template.ts';

const VIEWER_URL = 'https://molow.github.io/reporters/';

function readClientBundle(): string {
  try {
    const url = new URL('./embedded.global.js', import.meta.url);
    return readFileSync(fileURLToPath(url), 'utf8');
  } catch {
    return '/* @reporters/web client bundle missing — run the package build */';
  }
}

/** Best-effort: the single file this reporter is being written to, parsed from
 *  `--test-reporter-destination`. It's a Node CLI option, so it lives in
 *  execArgv (before the test files), not argv. Undefined if there are none/many
 *  (ambiguous) or the destination is a stream (stdout/stderr). */
export function soleFileDestination(execArgv: string[] = process.execArgv): string | undefined {
  const flag = '--test-reporter-destination';
  const dests: string[] = [];
  for (let i = 0; i < execArgv.length; i += 1) {
    if (execArgv[i] === flag && execArgv[i + 1]) dests.push(execArgv[i + 1]);
    else if (execArgv[i].startsWith(`${flag}=`)) dests.push(execArgv[i].slice(flag.length + 1));
  }
  const files = dests.filter((d) => d && d !== 'stdout' && d !== 'stderr');
  return files.length === 1 ? files[0] : undefined;
}

export function isCI(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CI || env.CONTINUOUS_INTEGRATION || env.GITHUB_ACTIONS || env.GITLAB_CI || env.BUILDKITE);
}

/** Open the report automatically on a developer's machine, but not in CI.
 *  `REPORTERS_WEB_OPEN=1|0` forces it on/off. */
export function shouldOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.REPORTERS_WEB_OPEN;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return !isCI(env);
}

/** The platform command to open a URL in the default browser. */
export function openCommand(url: string, platform: NodeJS.Platform = process.platform): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]];
  if (platform === 'win32') return ['cmd', ['/c', 'start', '', url]];
  return ['xdg-open', [url]];
}

/* c8 ignore start -- spawning a real browser isn't unit-testable */
function openInBrowser(url: string): void {
  const [cmd, args] = openCommand(url);
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* no browser / headless — ignore */ });
    child.unref();
  } catch { /* ignore */ }
}
/* c8 ignore stop */

/** Indirection so tests can observe the open without launching a browser. */
export const internals = { openInBrowser };

function hint(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * A self-contained, interactive HTML tree reporter for `node:test`.
 *
 * Two modes via `REPORTERS_WEB_MODE`:
 *  - `embedded` (default): streams a single self-contained .html file (inlined
 *    React app + the NDJSON event log). Point it at a file with
 *    `--test-reporter-destination=report.html`. On a dev machine it opens the
 *    report in your browser as it streams (disable with `REPORTERS_WEB_OPEN=0`).
 *  - `ndjson`: streams only the raw NDJSON event log, for the hosted viewer
 *    (open the viewer with `?src=<url-to-the-ndjson>`).
 *
 * `embedded` is the default deliberately: it's fully self-contained and works
 * everywhere (offline, as a CI artifact, attached to a gist) with no hosting.
 */
export default async function* web(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const mode = process.env.REPORTERS_WEB_MODE === 'ndjson' ? 'ndjson' : 'embedded';
  const dest = soleFileDestination();

  if (mode === 'ndjson') {
    for await (const event of source) yield serializeWireLine(event);
    hint(dest
      ? `\n@reporters/web: host ${resolve(dest)} and open ${VIEWER_URL}?src=<its-url>`
      : `\n@reporters/web: open ${VIEWER_URL}?src=<url-to-your-ndjson> to view`);
    return;
  }

  const url = dest ? pathToFileURL(resolve(dest)).href : undefined;
  yield htmlHeader(readClientBundle());
  // Open early so the report streams live in the browser (it self-refreshes).
  if (url && shouldOpen()) internals.openInBrowser(url);
  for await (const event of source) yield safeEventLine(serializeWireLine(event));
  yield HTML_FOOTER;
  hint(url
    ? `\n@reporters/web: report at ${url}`
    : '\n@reporters/web: open the generated HTML report in a browser');
}
