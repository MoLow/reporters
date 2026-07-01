# @reporters/web

A self-contained, interactive **HTML** tree reporter for `node:test`. It renders
the whole run as a collapsible tree on a single, offline HTML page (React,
inlined — no CDN, no network), with a summary, search/filter, per-test
diagnostics, and light/dark themes.

```bash
node --test --test-reporter=@reporters/web --test-reporter-destination=report.html
```

It streams like every other reporter — it yields to whatever
`--test-reporter-destination` points at.

## Modes

The reporter emits an NDJSON event log, consumed two ways via
`REPORTERS_WEB_MODE`:

- **`embedded`** (default) — a single, self-contained `.html` file with the React
  app and the event log inlined. Works offline, as a CI artifact, or attached to
  a gist. Even a crashed/interrupted run leaves a renderable partial file.
- **`ndjson`** — the raw NDJSON event log only. Host it anywhere and open it in
  the hosted viewer at **https://molow.github.io/reporters/** with
  `?src=<url-to-your-run.ndjson>` to watch it live (the viewer polls the file as
  it grows, using HTTP Range for newly appended lines).

```bash
# raw NDJSON for the hosted viewer
REPORTERS_WEB_MODE=ndjson node --test \
  --test-reporter=@reporters/web --test-reporter-destination=run.ndjson
# then host run.ndjson and open: https://molow.github.io/reporters/?src=<its-url>
```

`embedded` is the default because it needs no hosting; `ndjson` is opt-in for the
live hosted viewer. (The mode isn't inferred from TTY/CI: the reporter writes to
a destination, not the terminal, so those signals don't say which format you
want.) On completion the reporter prints a hint to stderr with the report path /
viewer URL.

Built on the shared `@reporters/tree-core` model (also used by
[`@reporters/live`](https://www.npmjs.com/package/@reporters/live)).
