![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# reporters
A collection of reporters for `node:test`


## Usage

```bash
node --test \
  --test-reporter=@reporters/github --test-reporter-destination=stdout \
  --test-reporter=@reporters/junit --test-reporter-destination=junit.xml \
  --test-reporter=spec --test-reporter-destination=stdout
```

Available reporters:

- [bail](https://www.npmjs.com/package/@reporters/bail) - bail on first failure
- [gh](https://www.npmjs.com/package/@reporters/gh) - all-in-one GitHub Actions reporter (readable log + annotations + summary in one)
- [github](https://www.npmjs.com/package/@reporters/github) - GitHub Actions annotations + job summary only (pair with another reporter for the log)
- [jUnit](https://www.npmjs.com/package/@reporters/junit) - report to jUnit 
- [live](https://www.npmjs.com/package/@reporters/live) - a live, React-powered tree reporter that renders the running test tree in your terminal
- [mocha](https://www.npmjs.com/package/@reporters/mocha) - use any mocha reporter with `node:test`
- [silent](https://www.npmjs.com/package/@reporters/silent) - a silent reporter
- [slow](https://www.npmjs.com/package/@reporters/slow) - report slow tests
- [testwatch](https://www.npmjs.com/package/@reporters/testwatch) - An interactive REPL for `node:test` watch mode.
- [web](https://www.npmjs.com/package/@reporters/web) - a self-contained, interactive HTML tree report (with an optional hosted live viewer)

## Tree reporters: `live` and `web`

[`@reporters/live`](https://www.npmjs.com/package/@reporters/live) and [`@reporters/web`](https://www.npmjs.com/package/@reporters/web) render the whole run as a collapsible **tree** built from the `node:test` event stream (powered by React). They share a common core that keeps the tree state; `live` renders it to the terminal with [Ink](https://github.com/vadimdemedes/ink), `web` renders it as an interactive HTML page. Both auto-expand failures, collapse passed suites to a count, and let you expand/collapse each test's diagnostics.

```bash
# live — a tree that updates in place as tests run (TTY); plain text in CI
node --test --test-reporter=@reporters/live

# web — write a single, self-contained, interactive HTML file
node --test --test-reporter=@reporters/web --test-reporter-destination=report.html
```

> [!NOTE]
> Under the default process isolation, Node buffers each test file's events until that file's turn to report, so files appear as they complete. For true real-time, per-test streaming in `live`, run with `--test-isolation=none`.

### `web` modes

`@reporters/web` emits an NDJSON event log, consumed two ways via `REPORTERS_WEB_MODE`:

- **`embedded`** (default) — a single, offline, self-contained `.html` file with the React app and the event log inlined. Even a crashed/interrupted run leaves a renderable partial file.
- **`ndjson`** — the raw NDJSON event log only. Host it anywhere and open it in the hosted viewer at **https://molow.github.io/reporters/** with `?src=<url-to-your-run.ndjson>` to watch it live (the viewer polls the file as it grows).

```bash
# raw NDJSON for the hosted viewer
REPORTERS_WEB_MODE=ndjson node --test \
  --test-reporter=@reporters/web --test-reporter-destination=run.ndjson
# then open: https://molow.github.io/reporters/?src=<url-to-run.ndjson>
```

## GitHub Actions: `gh` vs `github`

Both [`@reporters/gh`](https://www.npmjs.com/package/@reporters/gh) and [`@reporters/github`](https://www.npmjs.com/package/@reporters/github) add GitHub Actions annotations (inline errors + diagnostics) and a job summary. The difference is whether they also produce the human-readable test log:

| | `@reporters/gh` | `@reporters/github` |
|---|---|---|
| Human-readable log | ✅ built in (spec-style) | ❌ none — pair with another reporter |
| Annotations + job summary | ✅ | ✅ |
| Reporters needed | one | two (it + e.g. `spec`) |
| Output outside GitHub Actions | spec-style log | nothing (no-op) |
| Best when | you want a single reporter that does everything | you already have a reporter you like and just want to add annotations |

In short: reach for **`gh`** for the batteries-included experience, or **`github`** to layer annotations onto your own choice of reporter.

```bash
# gh — one reporter: readable log + annotations + summary
node --test --test-reporter=@reporters/gh

# github — annotations + summary, paired with spec for the readable log
node --test \
  --test-reporter=@reporters/github --test-reporter-destination=stdout \
  --test-reporter=spec --test-reporter-destination=stdout
```
