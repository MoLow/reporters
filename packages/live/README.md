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
- **Interactive review** — after the run it stays open so you can browse:
  - `↑`/`↓` (or `k`/`j`) — move between tests that have diagnostics
  - `space` / `enter` — toggle the selected test's diagnostics
  - `q` / `Ctrl+C` — close
- **CI-friendly** — outside a TTY it prints a plain-text tree at the end instead
  of ANSI. Force that anywhere with `REPORTERS_LIVE_PLAIN=1`.

> [!NOTE]
> Under the default process isolation, Node buffers each test file's events
> until that file's turn to report, so files fill in as they complete. For true
> real-time, per-test streaming across files, run with `--test-isolation=none`.

Built on the shared `@reporters/tree-core` model (also used by
[`@reporters/web`](https://www.npmjs.com/package/@reporters/web)).
