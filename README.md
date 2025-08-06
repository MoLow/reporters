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
- [gh](https://www.npmjs.com/package/@reporters/gh) - a all in one github actions reporter
- [github](https://www.npmjs.com/package/@reporters/github) - report to github actions
- [jUnit](https://www.npmjs.com/package/@reporters/junit) - report to jUnit 
- [mocha](https://www.npmjs.com/package/@reporters/mocha) - use any mocha reporter with `node:test`
- [silent](https://www.npmjs.com/package/@reporters/silent) - a silent reporter
- [slow](https://www.npmjs.com/package/@reporters/slow) - report slow tests
- [testwatch](https://www.npmjs.com/package/@reporters/testwatch) - An interactive REPL for `node:test` watch mode.
