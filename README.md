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
- [mux](https://www.npmjs.com/package/@reporters/mux) - route/combine reporters per environment (e.g. `live` locally, `gh` on CI) and send each to its own sink
- [gh](https://www.npmjs.com/package/@reporters/gh) - all-in-one GitHub Actions reporter (readable log + annotations + summary in one)
- [github](https://www.npmjs.com/package/@reporters/github) - GitHub Actions annotations + job summary only (pair with another reporter for the log)
- [jUnit](https://www.npmjs.com/package/@reporters/junit) - report to jUnit 
- [live](https://www.npmjs.com/package/@reporters/live) - a live, React-powered tree reporter that renders the running test tree in your terminal
- [mocha](https://www.npmjs.com/package/@reporters/mocha) - use any mocha reporter with `node:test`
- [silent](https://www.npmjs.com/package/@reporters/silent) - a silent reporter
- [slow](https://www.npmjs.com/package/@reporters/slow) - report slow tests
- [testwatch](https://www.npmjs.com/package/@reporters/testwatch) - An interactive REPL for `node:test` watch mode.
- [web](https://www.npmjs.com/package/@reporters/web) - an NDJSON reporter with an interactive HTML tree viewer (served locally via `@reporters/mux` or through the hosted viewer)

The `live` and `web` reporters render the run as an interactive **tree** and share a common core — see their package READMEs ([live](packages/live/README.md), [web](packages/web/README.md)) for details.

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
