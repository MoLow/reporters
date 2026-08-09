![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Web Reporter

Read your `node:test` run in the browser — a dense, interactive tree with live
updates, search, and failures you can scan without opening anything.

`@reporters/web` streams the run as an **NDJSON** event log, and ships a React
**viewer** that renders it: pass/fail counts and progress at a glance, the full
suite tree with per-test durations and rolled-up failure counts, and every
failure previewed on one line under the row that produced it.

[![the @reporters/web viewer showing a run with a failure previewed inline](https://raw.githubusercontent.com/MoLow/reporters/4772c1bd6e09677e2608ec42e08a22461532912b/packages/web/assets/viewer.png)](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/4772c1bd6e09677e2608ec42e08a22461532912b/packages/web/assets/demo-run.ndjson)

**[▶ Open the live demo](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/4772c1bd6e09677e2608ec42e08a22461532912b/packages/web/assets/demo-run.ndjson)** — the screenshot above, in the hosted viewer.

A row's log button (with its line count) opens that node's **Error**, **Output**
and **Messages** in one dialog over the tree — closed with `Esc`, the scrim, or
`✕`. Clicking a failure's preview line opens it straight to the error:

![the logs dialog showing a failing test's assertion error and stack](https://raw.githubusercontent.com/MoLow/reporters/4772c1bd6e09677e2608ec42e08a22461532912b/packages/web/assets/logs-popup.png)

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

## Consuming the NDJSON from your own tooling

Every line is one JSON-encoded `node:test` event, so the log is easy to feed
into dashboards, notifiers or CI annotations — not just the viewer. Failure
events carry the error on `data.details.error`:

```jsonc
{
  "message": "1 subtest failed",
  "name": "Error",
  "stack": "…", // util.inspect-style: extra enumerable props appear here
  "code": "ERR_TEST_FAILURE",
  "failureType": "subtestsFailed", // e.g. testCodeFailure, hookFailed, cancelledByParent
  "cause": { /* the original error, same shape, recursive */ }
}
```

`code` and `failureType` are copied from the runner's error when they are
strings, so a consumer can branch on
`error.failureType === 'subtestsFailed'` instead of matching message text.
Logs written by older versions of this reporter lack these two fields.

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
import { TestReportViewer, memoryFilterState, type TestNode } from '@reporters/web/viewer';

const filters = memoryFilterState();

<TestReportViewer
  src={reportUrl}
  fetch={authenticatedFetch}  // optional; receives the Range header
  pollMs={250}                // optional; default 1000
  filters={filters}           // optional; defaults to the shareable page URL
  dense="cozy"                // optional; 'compact' (default) or 'cozy'
  renderNodeActions={(node: TestNode) => (node.type === 'test'
    ? <button onClick={() => rerun(node)}>↻ rerun</button>
    : null)}
  renderHeaderActions={() => <button onClick={rerunAll}>↻ rerun all</button>}
/>
```

Filter state (search, status chips, Only re-run) lives in a pluggable
`FilterStore`. The default is `urlFilterState()` — shareable
`?q`/`?status`/`?rerun` params, exactly like the standalone page. Pass
`memoryFilterState()` when the host app owns the address bar, or implement the
three-method interface to bind filters to your router or state container:

```ts
interface FilterStore {
  read(): FilterState;                                        // initial state on mount
  write(state: FilterState): void;                            // called on every change
  subscribe?(onChange: (s: FilterState) => void): () => void; // external changes
}
```

The store instance must be stable for the life of the component — create it
outside the render (or in `useState`/`useMemo`).

`dense` picks the row metrics: `compact` (26px rows, the default — a real run is
hundreds of rows) or `cozy` (34px, a roomier hit area). Below 640px both give
way to 40px touch rows.

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
`null` to render nothing for a node. The result sits after the row's log button
and before its status pills and duration, wrapped in a `.node-actions` element
that swallows clicks and keystrokes so your buttons never toggle the row's
disclosure or open its logs. It is called on every render (which is frequent
during a live run), so keep it cheap.

Visibility is yours to style — e.g. reveal on row hover:

```css
.node-actions { visibility: hidden; }
.row:hover .node-actions, .row:focus-within .node-actions { visibility: visible; }
```

### `renderHeaderActions`

Renders custom content in the header toolbar, to the right of the built-in
buttons (search, theme, collapse all), wrapped in a `.header-actions` element.
Same contract as `renderNodeActions`: called on every render, so keep it cheap.
