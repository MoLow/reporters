import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeWireLine, type TestEvent } from '@reporters/tree-core';
import { htmlHeader, HTML_FOOTER, safeEventLine } from './template.ts';

function readClientBundle(): string {
  try {
    const url = new URL('./embedded.global.js', import.meta.url);
    return readFileSync(fileURLToPath(url), 'utf8');
  } catch {
    return '/* @reporters/web client bundle missing — run the package build */';
  }
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
 */
export default async function* web(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const mode = process.env.REPORTERS_WEB_MODE === 'ndjson' ? 'ndjson' : 'embedded';

  if (mode === 'ndjson') {
    for await (const event of source) yield serializeWireLine(event);
    return;
  }

  yield htmlHeader(readClientBundle());
  for await (const event of source) yield safeEventLine(serializeWireLine(event));
  yield HTML_FOOTER;
}
