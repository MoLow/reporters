[![npm version](https://img.shields.io/npm/v/@reporters/mocha)](https://www.npmjs.com/package/@reporters/mocha) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Mocha Reporters for `node:test`

Bring the entire [mocha reporter](https://mochajs.org/#reporters) ecosystem to
the built-in Node.js test runner.

Mocha has a decade's worth of reporters — `nyan`, `dot`, `landing`, `spec`,
plus community ones like [mochawesome](https://www.npmjs.com/package/mochawesome)'s
rich HTML reports. `@reporters/mocha` translates `node:test` events into
mocha's reporter API, so all of them — built-in **and** custom — just work.

![node:test rendered through mocha's nyan reporter](https://raw.githubusercontent.com/MoLow/reporters/d75babf46f9249c6f5bacdec077587e2a62339bd/packages/mocha/assets/cli.gif)

Yes, that's `node:test` running under the nyan cat. Migration from mocha never
looked so seamless — keep the reporting (and dashboards) you already have,
switch the runner underneath.

## Installation

```bash
npm install --save-dev @reporters/mocha
```
or
```bash
yarn add --dev @reporters/mocha
```

## Usage

Pick the mocha reporter in a standard [mocha configuration file](https://mochajs.org/#configuring-mocha-nodejs),
e.g. `.mocharc.json`:

```json
{
  "reporter": "nyan"
}
```

Custom reporters work too — anything mocha can load:

```json
{
  "reporter": "mochawesome"
}
```

Then run the tests with `node:test`:

```bash
node --test --test-reporter=@reporters/mocha
```
