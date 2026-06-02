[![npm version](https://img.shields.io/npm/v/@reporters/github)](https://www.npmjs.com/package/@reporters/github) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# GitHub Actions Annotations Reporter
Adds GitHub Actions annotations (inline error annotations and diagnostics) and a job summary to `node:test`.

This reporter emits **only** GitHub Actions workflow commands — it produces no human-readable test log of its own, so you pair it with another reporter (e.g. `spec`) for the readable output. Outside GitHub Actions it emits nothing.

> **`github` vs [`gh`](https://www.npmjs.com/package/@reporters/gh)**
> - **`@reporters/github`** (this package) — annotations and summary **only**. Layer it on top of whatever reporter you already use; it stays out of the way locally (no output unless running in GitHub Actions).
> - **`@reporters/gh`** — all-in-one: bundles a readable spec-style log **with** the annotations and summary, so you only need a single `--test-reporter`.
>
> See the [full comparison in the main README](https://github.com/MoLow/reporters#github-actions-gh-vs-github).

## Installation

```bash
npm install --save-dev @reporters/github
```
or
```bash
yarn add --dev @reporters/github
```

## Usage

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: node --test \
    --test-reporter=@reporters/github --test-reporter-destination=stdout \
    --test-reporter=spec --test-reporter-destination=stdout
```

The second reporter (`spec` here, but any reporter works) provides the human-readable log; `@reporters/github` adds the annotations and summary alongside it. If you'd rather not juggle two reporters, use [`@reporters/gh`](https://www.npmjs.com/package/@reporters/gh) instead.

## Result

when test failed, annotations will be added inside the github UI, with corresponding errors and diagnostics.
see [example run](https://github.com/MoLow/reporters/actions/runs/5607828636):

#### Inline annotations

<img width="810" alt="Inline Annotation" src="https://user-images.githubusercontent.com/8221854/254798653-0c06278e-696b-42eb-8275-364b7eb3133b.png">

additionally, Annotations and summary will be added to the summary of the test run.

#### Annotations

<img width="810" alt="Annotation" src="https://user-images.githubusercontent.com/8221854/254798495-38c2a8ea-c9e0-4e87-a13e-677826b72192.png">

#### Summary
<img width="815" alt="Summary" src="https://github.com/MoLow/reporters/assets/8221854/8934f5bb-3342-430c-9ae0-3c608a40c9f0">

