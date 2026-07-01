![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Live Tree Reporter

Watch your `node:test` run unfold as a live, collapsible tree — right in the
terminal.

`@reporters/live` renders the whole run as a tree (via
[Ink](https://github.com/vadimdemedes/ink) + React), updating in place as tests
execute: each test appears when it starts and flips to ✓/✗ the moment it
actually finishes. When the run ends, the tree stays open so you can browse
failures interactively — expand a failing test and its assertion diff, stack
trace, stdout/stderr and diagnostics unfold inline.

![@reporters/live rendering a run as a live tree, then expanding a failure's diagnostics](https://raw.githubusercontent.com/MoLow/reporters/e950437dee2debf018d19a18abc9b951b056dd9b/packages/live/assets/cli.gif)

## Installation

```bash
npm install --save-dev @reporters/live
```
or
```bash
yarn add --dev @reporters/live
```

## Usage

```bash
node --test --test-reporter=@reporters/live
```

## What you get

- **Live** — tests appear as they start and complete in real execution order.
- **Full tree, always expanded** — you always see every test; only per-test
  diagnostics (errors, stdout/stderr, `diagnostic()` messages) collapse.
- **Interactive review** — when stdin is a TTY it stays open after the run so
  you can browse:
  - `↑`/`↓` (or `k`/`j`) — move between tests that have diagnostics
  - `space` / `enter` — toggle the selected test's diagnostics
  - `q` / `Ctrl+C` — close
- **CI-friendly** — output and input are decided independently:
  - **stdout is a TTY** → live tree; otherwise a fully expanded plain-text tree
    printed once at the end.
  - **stdin is a TTY** → stays open for review; otherwise exits as soon as the
    run ends.

  So `npm run test` (TTY stdout, no interactive stdin) shows the live tree and
  then exits, while a plain pipe or CI prints text and exits. Set
  `REPORTERS_LIVE_PLAIN=1` to force plain text and exit-when-done everywhere.

> [!NOTE]
> Under the default process isolation, Node buffers each test file's events
> until that file's turn to report, so files fill in as they complete. For true
> real-time, per-test streaming across files, run with `--test-isolation=none`.

Built on the shared [`@reporters/tree-core`](https://github.com/MoLow/reporters/tree/main/packages/tree-core)
model (also used by [`@reporters/web`](https://github.com/MoLow/reporters/tree/main/packages/web)) —
the same run state, rendered in the terminal instead of the browser.
