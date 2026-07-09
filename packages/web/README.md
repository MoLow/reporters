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

## Embedding the viewer (`@reporters/web/viewer`)

The export is a browser ESM module that bundles everything except React —
`react` and `react-dom` are (optional) peer dependencies, so your app's TSX and
the viewer share one React 19 instance.

### `<TestReportViewer>` — the viewer as a component

Render the whole viewer anywhere in a React app — a tab, a modal, a split
pane. It polls `src` with HTTP Range, live-updates until the run's final
summary, and stops polling on unmount. Styles are injected into
`document.head` on first mount.

```tsx
import { TestReportViewer, type TestNode } from '@reporters/web/viewer';

<TestReportViewer
  src={reportUrl}
  fetch={authenticatedFetch}  // optional; receives the Range header
  pollMs={250}                // optional; default 1000
  renderNodeActions={(node: TestNode) => (node.type === 'test'
    ? <button onClick={() => rerun(node)}>↻ rerun</button>
    : null)}
  renderHeaderActions={() => <button onClick={rerunAll}>↻ rerun all</button>}
/>
```

Filters (search, status chips, Only re-run) live in memory — the component
never touches the host page's URL. Pass `syncUrl` to opt into the standalone
page's shareable `?q`/`?status`/`?rerun` params.

### `startViewer()` — a full viewer page

For a dedicated static page on the same UI (the hosted viewer is exactly
this), `startViewer` reads `?src=`/`?poll=` from the page URL, mounts into
`#root`, and keeps filters in the URL so views are shareable. Reports that
need authentication (private buckets, SSO) plug in a source resolver:

```tsx
import { startViewer } from '@reporters/web/viewer';

startViewer({
  resolveSource: async (params) => {
    if (params.get('src') || !params.get('key')) return null; // default handling
    const credentials = await acquireCredentialsSomehow();
    return { url: params.get('key')!, fetch: authenticatedFetch(credentials) };
  },
  renderNodeActions: ...,   // both hooks work here too
  renderHeaderActions: ...,
});
```

`resolveSource` runs before anything renders. Return `null`/`undefined` to fall
through to the default `?src=` handling; return `{ url, fetch?, pollMs? }` to
take over. The custom `fetch` receives the reader's `Range` header and must
return a standard `Response`; a thrown error shows the viewer's load-error
screen, and a promise that never resolves is fine while an auth redirect is in
flight.

### `renderNodeActions`

Renders custom content on every tree row — containers and tests alike; return
`null` to render nothing for a node. The result sits between the test name and
the row's built-in trailing indicators (status pills, duration), wrapped in a
`.node-actions` element that swallows clicks and keystrokes so your buttons
never toggle the row's disclosure. It is called on every render (which is
frequent during a live run), so keep it cheap.

Visibility is yours to style — e.g. reveal on row hover:

```css
.node-actions { visibility: hidden; }
.row:hover .node-actions, .row:focus-within .node-actions { visibility: visible; }
```

### `renderHeaderActions`

Renders custom content in the header toolbar, to the right of the built-in
buttons (search, theme, collapse all), wrapped in a `.header-actions` element.
Same contract as `renderNodeActions`: called on every render, so keep it cheap.
