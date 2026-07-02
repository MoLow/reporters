[![npm version](https://img.shields.io/npm/v/@reporters/bail)](https://www.npmjs.com/package/@reporters/bail) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Bail on the First Failure

Stop the whole test run the moment a single test fails.

`node:test` has no built-in `--bail` flag — once something breaks, the runner
happily grinds through every remaining test while you wait for feedback you
already have. `@reporters/bail` fixes that: the instant any test fails, it
aborts the run and exits non-zero.

![@reporters/bail aborting a run on the first failing test](https://raw.githubusercontent.com/MoLow/reporters/88901486cc58a9c706d5de24b44c8dd0630bf369/packages/bail/assets/cli.gif)

Perfect for:

- **Local TDD loops** — you only care about the first failure anyway.
- **CI pipelines** — fail fast instead of burning minutes on a doomed run.
- **Expensive suites** — integration tests that hit databases or spin up
  services shouldn't keep running after the build is already red.

## Installation

```bash
npm install --save-dev @reporters/bail
```
or
```bash
yarn add --dev @reporters/bail
```

## Usage

`@reporters/bail` produces no test log of its own — it only watches for
failures — so run it alongside any reporter you like to read:

```bash
node --test \
  --test-reporter=@reporters/bail --test-reporter-destination=stderr \
  --test-reporter=spec --test-reporter-destination=stdout
```

When a test fails you'll see the log up to that point, then:

```
✖ Bailing on failed test: applies the loyalty discount for gold members
```

…and the process exits immediately with a non-zero code.
