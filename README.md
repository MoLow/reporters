# rporting
reporters for `node:test`


## Usage

```bash
node --test \
  --test-reporter=rporting/github --test-reporter-destination=stdout \
  --test-reporter=rporting/jUnit --test-reporter-destination=junit.xml \
  --test-reporter=spec --test-reporter-destination=stdout
```

available reporters:

- `github` - report to github actions
- `jUnit` - report to jUnit 