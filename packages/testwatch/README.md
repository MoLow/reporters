[![npm version](https://img.shields.io/npm/v/@reporters/testwatch)](https://www.npmjs.com/package/@reporters/testwatch) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Interactive Watch Mode for `node:test`

A jest-style interactive watch REPL for the built-in Node.js test runner.

`testwatch` runs your suite, stays open, and reruns on demand — and you can
narrow the run from the keyboard without ever restarting: filter by file name
pattern, filter by test name pattern, stack the two, clear them, run again.
The tight feedback loop you're used to from `jest --watch`, for `node:test`.

![testwatch running a suite, then filtering by file and by test name](https://raw.githubusercontent.com/MoLow/reporters/6f8d755a21c3cb627f65878de4d68fba1530d66b/packages/testwatch/assets/cli.gif)

## Installation

```bash
npm install -g @reporters/testwatch
```
or run it without installing:
```bash
npx @reporters/testwatch
```

## Usage

Run `testwatch` in the root of your project:

```bash
testwatch
```

You can also seed the file filter from the command line:

```bash
testwatch "integration/**"
```

## Keyboard commands

| Key | Action |
| --- | --- |
| `a` | run all tests |
| `p` | filter by a file name pattern |
| `t` | filter by a test name pattern |
| `c` | clear the active filters |
| `Enter` | trigger a test run |
| `w` | show the full menu |
| `q` / `Ctrl+C` | quit |

File and test filters compose: filter files to `cart`, then tests to `total`,
and only tests matching both run — everything else is reported as skipped.
