![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Reporter Multiplexer

One `--test-reporter` flag, every environment covered.

`@reporters/mux` is environment-aware routing for `node:test` reporters.
Register it once; it reads a `mux.config` file, picks the active **profile**
(`ci` vs `local`, auto-detected), tees the test-event stream to every configured
**reporter**, and pipes each reporter's output into its **sink** —
`stdout`/`stderr`, a file, a local HTTP viewer, or a remote upload with a
shareable report URL.

The same command gives you a live interactive tree at your desk, and a CI log
plus a browsable report link on the build server:

![the same mux command rendering a live tree locally and a CI log with a report link under REPORTERS_PROFILE=ci](https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/mux/assets/cli.gif)

That `report at` link is [`@reporters/web`](https://github.com/MoLow/reporters/tree/main/packages/web)'s
run being delivered through a sink — it opens as an interactive tree in the
browser (**[live demo](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/demo-run.ndjson)**):

[![the browser viewer rendering the delivered run](https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/viewer.png)](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/demo-run.ndjson)

## Usage

```bash
node --test-reporter=@reporters/mux --test
```

## Config

Create a `mux.config.js` (or `.mjs`/`.ts`), discovered by walking up from the
current directory. It default-exports a map of profile name → routes:

```js
import { httpServer } from '@reporters/web/sink';
import { gist } from '@reporters/sink';
import live from '@reporters/live';

export default {
  local: [
    { reporter: live,             sink: 'stdout' },
    { reporter: '@reporters/web', sink: httpServer() }, // serves localhost, opens the browser
  ],
  ci: [
    { reporter: '@reporters/gh',  sink: 'stdout' },
    { reporter: '@reporters/web', sink: gist() }, // uploads the run, links the hosted viewer
  ],
};
```

Both async-generator reporters (like `@reporters/live`, `@reporters/web`) and
Transform-stream reporters (like `@reporters/gh`) are supported as route reporters.

### Route fields

- `reporter` — a reporter function, a Transform/Duplex stream, or a module specifier `mux` will `import()`.
- `options` — optional 2nd-arg object passed to the reporter (e.g.
  `@reporters/web` accepts `{ open: boolean }`); most reporters need none.
- `sink` — `'stdout'`, `'stderr'`, a file path, or a `Sink` object.
- `open` — open the sink's viewer URL in a browser. Defaults to on locally, off
  in CI. `open: false` opts out; `REPORTERS_OPEN=1|0` forces it. This is the
  only open gate: a reporter can declare default options for when it runs under
  mux — attached to the reporter function under
  `Symbol.for('reporters.mux.defaultOptions')`, merged beneath the route's
  `options` — which is how reporters that self-open standalone (like
  `@reporters/web`, declaring `{ open: false }`) stay pure emitters here.

### Profile resolution

`REPORTERS_PROFILE` if set; otherwise `ci` when a CI environment is detected
(`CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `BUILDKITE`, …), else `local`. Profile
names are yours — add a `nightly` or `benchmark` profile and select it with
`REPORTERS_PROFILE=nightly`.

## Sinks

A sink decides where a reporter's bytes go — and, for viewers, where a human
looks:

```ts
interface Sink {
  start?(): Promise<void>;
  write(chunk: string | Buffer): void | Promise<void>;
  flush?(): Promise<void>;
  close(): Promise<void>;
  viewerUrl?(): string | undefined;
}
```

Built in: `'stdout'`, `'stderr'`, and file paths. Beyond those:

- [`@reporters/web`](https://github.com/MoLow/reporters/tree/main/packages/web)
  ships `httpServer()` — serves the viewer on localhost over the growing run.
- [`@reporters/sink`](https://github.com/MoLow/reporters/tree/main/packages/sink)
  ships `gist()` and `s3()` — upload the run where a browser can fetch it, so
  the hosted viewer can render CI runs — plus `remoteSink()` to bring your own
  transport.

When a sink exposes a `viewerUrl`, mux prints `report at <url>` to stderr and —
on GitHub Actions — adds a **View report** link to the job summary.
