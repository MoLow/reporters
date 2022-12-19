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

- [github](https://www.npmjs.com/package/@reporters/junit) - report to github actions
- [jUnit](https://www.npmjs.com/package/@reporters/junit) - report to jUnit 