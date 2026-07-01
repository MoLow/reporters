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
 *  `--test-reporter-destination`. Undefined if there are none/many (ambiguous)
 *  or the destination is a stream (stdout/stderr). */
function soleFileDestination(): string | undefined {
  const flag = '--test-reporter-destination';
  const dests: string[] = [];
  const { argv } = process;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && argv[i + 1]) dests.push(argv[i + 1]);
    else if (argv[i].startsWith(`${flag}=`)) dests.push(argv[i].slice(flag.length + 1));
  }
  const files = dests.filter((d) => d && d !== 'stdout' && d !== 'stderr');
  return files.length === 1 ? files[0] : undefined;
}

function hint(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * A self-contained, interactive HTML tree reporter for `node:test`.
 *
 * Two modes via `REPORTERS_WEB_MODE`:
 *  - `embedded` (default): streams a single self-contained .html file (inlined
 *    React app + the NDJSON event log). Point it at a file with
 *    `--test-reporter-destination=report.html`.
 *  - `ndjson`: streams only the raw NDJSON event log, for the hosted viewer
 *    (open the viewer with `?src=<url-to-the-ndjson>`).
 *
 * `embedded` is the default deliberately: it's fully self-contained and works
 * everywhere (offline, as a CI artifact, attached to a gist) with no hosting.
 * `ndjson` is opt-in because it only becomes a report once its file is hosted
 * and opened in the viewer. This isn't inferred from TTY / CI: the reporter
 * writes to a destination (usually a file), not to the terminal, so those
 * signals don't indicate which format is wanted.
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

  yield htmlHeader(readClientBundle());
  for await (const event of source) yield safeEventLine(serializeWireLine(event));
  yield HTML_FOOTER;
  hint(dest
    ? `\n@reporters/web: report written to ${pathToFileURL(resolve(dest)).href}`
    : '\n@reporters/web: open the generated HTML report in a browser');
}
