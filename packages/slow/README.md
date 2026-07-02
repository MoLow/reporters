[![npm version](https://img.shields.io/npm/v/@reporters/slow)](https://www.npmjs.com/package/@reporters/slow) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Slow Tests Reporter

Find out exactly which tests are slowing your suite down.

`@reporters/slow` watches a `node:test` run and prints a report of every test
that took longer than 250ms — grouped by file, sorted slowest-first, with the
duration color-coded by severity and a clickable `file:line:column` location
for each offender.

![@reporters/slow listing the slowest tests grouped by file](https://raw.githubusercontent.com/MoLow/reporters/5393ed7b104f42d90bb930ad89854d8fdff6785b/packages/slow/assets/cli.gif)

| Duration | Color |
| --- | --- |
| under 250ms | not reported |
| 250–600ms | yellow |
| 600–900ms | orange |
| 900ms+ | red |

Tests faster than the threshold stay out of the report entirely, so the output
is only ever the shortlist worth optimizing.

## Installation

```bash
npm install --save-dev @reporters/slow
```
or
```bash
yarn add --dev @reporters/slow
```

## Usage

```bash
node --test-reporter=@reporters/slow --test
```

Or keep your usual reporter for results and add this one just for the timing
report:

```bash
node \
  --test-reporter=spec --test-reporter-destination=stdout \
  --test-reporter=@reporters/slow --test-reporter-destination=stdout \
  --test
```
