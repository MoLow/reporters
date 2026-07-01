[![npm version](https://img.shields.io/npm/v/@reporters/junit)](https://www.npmjs.com/package/@reporters/junit) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# JUnit XML Reporter

Turn `node:test` runs into JUnit XML — the lingua franca of CI test reporting.

Jenkins, GitLab, CircleCI, Buildkite, Azure Pipelines, and just about every
other CI system can ingest JUnit reports to give you test dashboards, flaky-test
tracking, failure history, and PR annotations. `@reporters/junit` maps the full
`node:test` suite tree — nested suites included — onto `<testsuite>` /
`<testcase>` elements, with timings, failures, errors, and skips.

![@reporters/junit emitting JUnit XML for a node:test run](https://raw.githubusercontent.com/MoLow/reporters/e950437dee2debf018d19a18abc9b951b056dd9b/packages/junit/assets/cli.gif)

## Installation

```bash
npm install --save-dev @reporters/junit
```
or
```bash
yarn add --dev @reporters/junit
```

## Usage

Write the XML to a file for your CI system to pick up, and keep a human-readable
reporter on stdout:

```bash
node --test \
  --test-reporter=@reporters/junit --test-reporter-destination=report.xml \
  --test-reporter=spec --test-reporter-destination=stdout
```

Then point your CI at the report — e.g. in GitLab:

```yaml
artifacts:
  reports:
    junit: report.xml
```

## Failure output

Failed tests carry the failure message and full error detail, so CI dashboards
can show you exactly what broke:

```xml
<testsuite name="totals" time="0.04376" disabled="0" errors="0" tests="3" failures="1" skipped="0">
  <testcase name="computes the subtotal across line items" time="0.00637" classname="test"/>
  <testcase name="applies the loyalty discount for gold members" time="0.01467" classname="test" failure="Expected values to be strictly deep-equal">
    <failure message="Expected values to be strictly deep-equal" type="testCodeFailure">
      ...full assertion diff and stack trace...
    </failure>
  </testcase>
</testsuite>
```
