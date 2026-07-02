![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Web Reporter

Read your `node:test` run in the browser — a rich, interactive tree with live
updates, search, and inline failure diffs.

`@reporters/web` streams the run as an **NDJSON** event log, and ships a React
**viewer** that renders it: pass/fail counts and progress at a glance, the full
suite tree with per-test durations, ANSI-colored error output, and failing
tests auto-expanded with their assertion diff and stack trace.

[![the @reporters/web viewer showing a run with an expanded failure](https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/viewer.png)](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/demo-run.ndjson)

**[▶ Open the live demo](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/demo-run.ndjson)** — the screenshot above, in the hosted viewer.

## Usage

```bash
node --test-reporter=@reporters/web --test-reporter-destination=run.ndjson --test
```

On a dev machine that command does everything: it writes the NDJSON log **and**
opens a live-updating browser view of the run.

## Viewing a run

The NDJSON is rendered by the tree viewer, reached three ways:

- **Standalone** — on a dev machine, when given a file destination, the reporter
  also starts a local server for the viewer and opens your browser to a
  live-updating view (it polls the growing NDJSON over HTTP Range — no
  `file://`/CORS limits). It never opens in CI. Force it on/off with the `open`
  option (2nd reporter arg) or `REPORTERS_OPEN=1|0`.

- **Through [`@reporters/mux`](https://github.com/MoLow/reporters/tree/main/packages/mux)**
  with the `httpServer()` sink — the reporter stays a pure emitter and the sink
  serves the viewer + growing NDJSON over HTTP Range, opening your browser:

  ```js
  // mux.config.js
  import { httpServer } from '@reporters/web/sink';
  export default {
    // pass `open: false` on the route if it shouldn't open a browser
    local: [{ reporter: '@reporters/web', sink: httpServer() }],
  };
  ```

- **Hosted viewer** — host the NDJSON anywhere (a gist, an S3 bucket, a CI
  artifact, a raw GitHub URL) and open:

  ```
  https://molow.github.io/reporters/?src=<url-to-your-run.ndjson>
  ```

  The viewer polls the file as it grows using HTTP Range, so this works for
  runs that are still in progress — share the link and teammates watch the same
  run live.

Built on the shared [`@reporters/tree-core`](https://github.com/MoLow/reporters/tree/main/packages/tree-core)
model (also used by [`@reporters/live`](https://github.com/MoLow/reporters/tree/main/packages/live)) —
the same run state, rendered in the browser instead of the terminal.

## Custom report sources (`@reporters/web/viewer`)

The hosted viewer reads `?src=<url>` with plain `fetch`. To serve reports that
need authentication (private buckets, SSO), build your own viewer page on the
same UI with a custom source resolver:

```ts
import { startViewer } from '@reporters/web/viewer';

startViewer({
  resolveSource: async (params) => {
    if (params.get('src') || !params.get('key')) return null; // default handling
    const credentials = await acquireCredentialsSomehow();
    return { url: params.get('key')!, fetch: authenticatedFetch(credentials) };
  },
});
```

`resolveSource` runs before anything renders. Return `null`/`undefined` to fall
through to the default `?src=` handling; return `{ url, fetch?, pollMs? }` to
take over. The custom `fetch` receives the reader's `Range` header and must
return a standard `Response`; a thrown error shows the viewer's load-error
screen, and a promise that never resolves is fine while an auth redirect is in
flight. The export is a self-contained browser ESM module (React inlined) —
bundle it with your resolver into a static HTML page.
