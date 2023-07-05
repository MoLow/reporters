[![npm version](https://img.shields.io/npm/v/@reporters/junit)](https://www.npmjs.com/package/@reporters/junit) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Junit Reporter
A Junit reporter for `node:test`.
intendend for use with major CI tools like Jenkins, CircleCI, etc that consume Junit reports.

## Installation

```bash
npm install --save-dev @reporters/junit
```
or
```bash
yarn add --dev @reporters/junit
```

## Usage

```bash
node --test \
  --test-reporter=@reporters/junit --test-reporter-destination=stdout \
  --test-reporter=spec --test-reporter-destination=stdout
```

## Example 

Ouput of the following test file:

```js
const { describe, it } = require('node:test');

describe('tests', () => {
  it('is ok', () => {});
  it('fails', () => {
    throw new Error('this is an error');
  });
});
```

```xml
  <testsuite name="tests" time="0.00239" disabled="0" errors="0" tests="2" failures="1" skipped="0" hostname="PC.localdomain">
    <testcase name="is ok" time="0.00057" classname="test"></testcase>
    <testcase name="fails" time="0.00017" classname="test" failure="this is an error">
      <failure message="this is an error" type="testCodeFailure">
[Error [ERR_TEST_FAILURE]: this is an error] {
  failureType: 'testCodeFailure',
  cause: Error: this is an error
      at Object.&lt;anonymous&gt; (/Users/test/reporters/tests/example.js:6:11)
      at ItTest.runInAsyncScope (node:async_hooks:204:9)
      at ItTest.run (node:internal/test_runner/test:547:25)
      at Suite.processPendingSubtests (node:internal/test_runner/test:302:27)
      at ItTest.postRun (node:internal/test_runner/test:632:19)
      at ItTest.run (node:internal/test_runner/test:575:10)
      at async Promise.all (index 0)
      at async Suite.run (node:internal/test_runner/test:798:7),
  code: 'ERR_TEST_FAILURE'
}
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```
