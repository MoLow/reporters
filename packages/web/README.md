# @reporters/web

An **NDJSON** event-log reporter for `node:test`, with an interactive tree
**viewer** (React) for reading the run in a browser. It streams the run as NDJSON
to whatever `--test-reporter-destination` points at:

```bash
node --test --test-reporter=@reporters/web --test-reporter-destination=run.ndjson
```

## Viewing a run

The NDJSON is rendered by the tree viewer, reached three ways:

- **Standalone** — on a dev machine, when given a file destination, the reporter
  also starts a local server for the viewer and opens your browser to a
  live-updating view (it polls the growing NDJSON over HTTP Range — no
  `file://`/CORS limits). It never opens in CI. Force it on/off with the `open`
  option (2nd reporter arg) or `REPORTERS_WEB_OPEN=1|0`:

  ```bash
  # opens a live browser view by default on a TTY; never in CI
  node --test --test-reporter=@reporters/web --test-reporter-destination=run.ndjson
  ```

- **Through [`@reporters/mux`](https://www.npmjs.com/package/@reporters/mux)**
  with the `httpServer()` sink — the reporter stays a pure emitter and the sink
  serves the viewer + growing NDJSON over HTTP Range, opening your browser:

  ```js
  // mux.config.js
  import { httpServer } from '@reporters/web/sink';
  export default {
    // pass `options: { open: false }` on the route if it shouldn't open a browser
    local: [{ reporter: '@reporters/web', sink: httpServer() }],
  };
  ```

- **Hosted viewer** — host the NDJSON anywhere and open
  `https://molow.github.io/reporters/?src=<url-to-your-run.ndjson>`. The viewer
  polls the file as it grows using HTTP Range.

Built on the shared `@reporters/tree-core` model (also used by
[`@reporters/live`](https://www.npmjs.com/package/@reporters/live)).
