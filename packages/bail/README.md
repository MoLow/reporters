[![npm version](https://img.shields.io/npm/v/@reporters/bail)](https://www.npmjs.com/package/@reporters/bail) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# `node:test` Bail on failure
A package to bail on the first test failure of a test run
using node built in test runner.

## Installation

```bash
npm install --save-dev @reporters/bail
```
or
```bash
yarn add --dev @reporters/bail
```

## Usage

```bash
node --test \
  --test-reporter=@reporters/bail --test-reporter-destination=stderr \
  --test-reporter=spec --test-reporter-destination=stdout
```

### Example

![cli](https://raw.githubusercontent.com/MoLow/reporters/dbc82f3e738ac40cc75eafc15946f712ccad9c99/packages/bail/assets/cli.gif)
