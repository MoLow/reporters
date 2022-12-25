[![npm version](https://img.shields.io/npm/v/@reporters/github)](https://www.npmjs.com/package/@reporters/github) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main)
# Silent Reporter
A Silent reporter for `node:test`, in case you don't want to see any output.

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

the output will be empty, but the tests will still run,
and the exit code will be 0 if all tests pass, and 1 if any test fails.
