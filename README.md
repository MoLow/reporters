![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# reporters

Everything the built-in `node:test` reporters don't do: live interactive trees,
browser-viewable runs you can share by link, GitHub Actions annotations, an
interactive watch REPL, bail-on-failure, the whole mocha reporter ecosystem —
and a multiplexer that picks the right ones per environment, so one
`--test-reporter` flag covers your laptop and your CI.

![the same mux command rendering a live tree locally and a CI log with a report link under REPORTERS_PROFILE=ci](https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/mux/assets/cli.gif)

That `report at` link is [`@reporters/web`](packages/web)'s run being delivered
— it opens as an interactive tree in the browser
(**[live demo](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/demo-run.ndjson)**):

[![the browser viewer rendering the delivered run](https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/viewer.png)](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/web/assets/demo-run.ndjson)

## TL;DR — what you probably want

Register [`@reporters/mux`](packages/mux) once and let a config decide per
environment: a live interactive tree while developing, a GitHub-annotated log
plus a shareable browser report in CI.

```bash
npm i -D @reporters/mux @reporters/live @reporters/gh @reporters/web @reporters/sink
```

```js
// mux.config.mjs
import { httpServer } from '@reporters/web/sink';
import { gist } from '@reporters/sink';

export default {
  local: [
    { reporter: '@reporters/live', sink: 'stdout' },      // live tree, browse failures interactively
    { reporter: '@reporters/web',  sink: httpServer() },  // same run in the browser, on localhost
  ],
  ci: [
    { reporter: '@reporters/gh',  sink: 'stdout' },       // readable log + PR annotations + job summary
    { reporter: '@reporters/web', sink: gist() },         // uploads the run, links the hosted viewer
  ],
};
```

```json
// package.json
{ "scripts": { "test": "node --test-reporter=@reporters/mux --test" } }
```

That's it — `npm test` everywhere. mux detects CI, picks the profile, and in
GitHub Actions adds a **View report** link to the job summary (the `gist()`
sink needs a token — [two-line setup](packages/sink#gistoptions)).

Not ready for a config file? Every reporter also works standalone with plain
`--test-reporter` flags — start with one from the table below.

## The collection

### See the run

| Package | What it does |
| --- | --- |
| [live](packages/live) ([npm](https://www.npmjs.com/package/@reporters/live)) | Live, React-powered tree in the terminal — tests flip ✓/✗ as they finish, failures expand interactively |
| [web](packages/web) ([npm](https://www.npmjs.com/package/@reporters/web)) | The run in the browser — interactive tree with search, diffs, and a [hosted viewer](https://molow.github.io/reporters/) for shared links |
| [testwatch](packages/testwatch) ([npm](https://www.npmjs.com/package/@reporters/testwatch)) | Jest-style interactive watch REPL — rerun and filter by file/test from the keyboard |

### Report to CI

| Package | What it does |
| --- | --- |
| [gh](packages/gh) ([npm](https://www.npmjs.com/package/@reporters/gh)) | All-in-one GitHub Actions reporter: readable log + inline PR annotations + job summary |
| [github](packages/github) ([npm](https://www.npmjs.com/package/@reporters/github)) | Annotations + job summary only — layer it on top of the reporter you already use |
| [junit](packages/junit) ([npm](https://www.npmjs.com/package/@reporters/junit)) | JUnit XML for Jenkins, GitLab, CircleCI, Buildkite, Azure, … |

### Shape the run

| Package | What it does |
| --- | --- |
| [bail](packages/bail) ([npm](https://www.npmjs.com/package/@reporters/bail)) | Abort the whole run on the first failure — the missing `--bail` |
| [slow](packages/slow) ([npm](https://www.npmjs.com/package/@reporters/slow)) | List the tests over 250ms, color-coded, slowest first |
| [silent](packages/silent) ([npm](https://www.npmjs.com/package/@reporters/silent)) | No output at all — just the exit code |
| [mocha](packages/mocha) ([npm](https://www.npmjs.com/package/@reporters/mocha)) | Run any mocha reporter (nyan! mochawesome!) on `node:test` |

### Route and deliver

| Package | What it does |
| --- | --- |
| [mux](packages/mux) ([npm](https://www.npmjs.com/package/@reporters/mux)) | Environment-aware routing: tee the run to multiple reporters, each into its own sink, per profile |
| [sink](packages/sink) ([npm](https://www.npmjs.com/package/@reporters/sink)) | Delivery sinks for mux: upload the run to a gist or S3 so the hosted viewer can render it |

(`live` and `web` share one tree model, [tree-core](packages/tree-core) —
internal, but useful if you're building a tree-shaped reporter of your own.)

## Pick by need

- **"I just want nicer local output"** → [live](packages/live)
- **"I want a TDD loop"** → [testwatch](packages/testwatch), and [bail](packages/bail) for fail-fast
- **"I want PR annotations"** → [gh](packages/gh) (or [github](packages/github) — see below)
- **"My CI wants JUnit XML"** → [junit](packages/junit)
- **"I want to share a run with a teammate"** → [web](packages/web) + [sink](packages/sink)
- **"My suite is slow and I don't know why"** → [slow](packages/slow)
- **"I miss my mocha reporter"** → [mocha](packages/mocha)
- **"Several of the above, depending where it runs"** → [mux](packages/mux) — that's the TL;DR setup

Reporters compose without mux too — `node:test` accepts the flag repeatedly:

```bash
node \
  --test-reporter=@reporters/github --test-reporter-destination=stdout \
  --test-reporter=@reporters/junit  --test-reporter-destination=junit.xml \
  --test-reporter=spec              --test-reporter-destination=stdout \
  --test
```

## GitHub Actions: `gh` vs `github`

Both [`@reporters/gh`](https://www.npmjs.com/package/@reporters/gh) and [`@reporters/github`](https://www.npmjs.com/package/@reporters/github) add GitHub Actions annotations (inline errors + diagnostics) and a job summary. The difference is whether they also produce the human-readable test log:

| | `@reporters/gh` | `@reporters/github` |
|---|---|---|
| Human-readable log | ✅ built in (spec-style, collapsible per-test groups) | ❌ none — pair with another reporter |
| Annotations + job summary | ✅ | ✅ |
| Reporters needed | one | two (it + e.g. `spec`) |
| Output outside GitHub Actions | spec-style log | nothing (no-op) |
| Best when | you want a single reporter that does everything | you already have a reporter you like and just want to add annotations |

In short: reach for **`gh`** for the batteries-included experience, or **`github`** to layer annotations onto your own choice of reporter.

```bash
# gh — one reporter: readable log + annotations + summary
node --test-reporter=@reporters/gh --test

# github — annotations + summary, paired with spec for the readable log
node \
  --test-reporter=@reporters/github --test-reporter-destination=stdout \
  --test-reporter=spec --test-reporter-destination=stdout \
  --test
```
