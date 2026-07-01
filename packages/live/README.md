# @reporters/live

A live, React-powered **tree** reporter for `node:test`. It renders the whole
run as a collapsible tree in your terminal (via [Ink](https://github.com/vadimdemedes/ink)),
updating in place as tests run — each test flips to ✓/✗ the moment it actually
finishes, not when the reporter gets around to it.

```bash
node --test --test-reporter=@reporters/live --test
```

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

Built on the shared `@reporters/tree-core` model (also used by
[`@reporters/web`](https://www.npmjs.com/package/@reporters/web)).
