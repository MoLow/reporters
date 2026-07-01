![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Tree Core

The shared tree-state model behind
[`@reporters/live`](https://github.com/MoLow/reporters/tree/main/packages/live) and
[`@reporters/web`](https://github.com/MoLow/reporters/tree/main/packages/web).

Both reporters answer the same question — *what does this test run look like as
a tree, right now?* — in different places: one in the terminal via Ink, one in
the browser via React DOM. `@reporters/tree-core` is that shared answer,
extracted: a renderer-agnostic store that consumes `node:test` events and
maintains the run as an incrementally-updating tree.

One model, two renderers:

| `@reporters/live` (terminal) | `@reporters/web` (browser) |
| --- | --- |
| ![the live terminal tree](https://raw.githubusercontent.com/MoLow/reporters/e950437dee2debf018d19a18abc9b951b056dd9b/packages/live/assets/cli.gif) | ![the web viewer](https://raw.githubusercontent.com/MoLow/reporters/e950437dee2debf018d19a18abc9b951b056dd9b/packages/web/assets/viewer.png) |

> [!NOTE]
> This is an internal workspace package — it isn't published to npm. If you're
> building a tree-shaped reporter of your own, the pieces below are what the
> two reporters share.

## What it provides

- **`createTreeStore()`** — feed it `node:test` events, get a subscribable tree
  of suites and tests with statuses (queued → running → passed/failed/skipped),
  durations, counts, and per-test diagnostics (errors, stdout/stderr,
  `diagnostic()` messages).
- **Wire format** — `toWireEvent` / `serializeWireLine` / `parseWireLines`
  convert runner events to and from the JSON-safe NDJSON lines that
  `@reporters/web` streams, so a run can be replayed anywhere.
- **Presentation helpers** — `formatDuration`, `defaultExpanded`, and a shared
  color theme, so both renderers agree on how a run should read.
