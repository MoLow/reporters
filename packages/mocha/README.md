[![npm version](https://img.shields.io/npm/v/@reporters/mocha)](https://www.npmjs.com/package/@reporters/mocha) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Mocha reporters for `node:test`
Use this custom reporter to use [mocha reporters](https://mochajs.org/#reporters) with `node:test`.
Both built-in and custom mocha reporters such as [mochawesome](https://www.npmjs.com/package/mochawesome) are supported.

## Installation

```bash
npm install --save-dev @reporters/mocha
```
or
```bash
yarn add --dev @reporters/mocha
```

## Usage

Specify the desired mocha reporter inside the [mocha configuration file](https://mochajs.org/#configuring-mocha-nodejs), e.g. `.mocharc.js`:
```js
module.exports = {
  reporter: 'nyan'
}
```

Then run the tests with `node:test`:

```bash
node --test --test-reporter=@reporters/mocha
```


