[![npm version](https://img.shields.io/npm/v/@reporters/silent)](https://www.npmjs.com/package/@reporters/silent) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Silent Reporter

Run the tests, print nothing, let the exit code do the talking.

`@reporters/silent` swallows every test event and produces zero output. The
suite still runs in full — the process exits `0` when everything passes and
`1` when anything fails.

![@reporters/silent producing no output, only an exit code](https://raw.githubusercontent.com/MoLow/reporters/88901486cc58a9c706d5de24b44c8dd0630bf369/packages/silent/assets/cli.gif)

Handy whenever output is noise:

- **Shell scripting** — `node --test --test-reporter=@reporters/silent && deploy.sh`
- **Git hooks** — gate a commit or push on the suite without flooding the terminal.
- **Benchmarking** — measure the suite itself, not the cost of rendering output.
- **Muting one destination** — combine it with another reporter to keep a
  machine-readable report while silencing the console.

## Installation

```bash
npm install --save-dev @reporters/silent
```
or
```bash
yarn add --dev @reporters/silent
```

## Usage

```bash
node --test --test-reporter=@reporters/silent
```
