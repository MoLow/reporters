[![npm version](https://img.shields.io/npm/v/@reporters/gh)](https://www.npmjs.com/package/@reporters/gh) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# GitHub Actions Reporter (all-in-one)
An all-in-one GitHub Actions reporter for `node:test`: it prints a readable, spec-style test log **and** emits GitHub Actions annotations and a job summary — from a single reporter.

Outside GitHub Actions it falls back to the plain spec-style log, so the same command works locally and in CI.

> **`gh` vs [`github`](https://www.npmjs.com/package/@reporters/github)**
> - **`@reporters/gh`** (this package) — all-in-one: a human-readable log **plus** annotations and summary, from one reporter. Use it when you want a single `--test-reporter` that does everything.
> - **`@reporters/github`** — annotations and summary **only**; it prints no readable log, so you pair it with another reporter (e.g. `spec`). Use it when you already have a reporter you like and just want to layer GitHub annotations on top.
>
> See the [full comparison in the main README](https://github.com/MoLow/reporters#github-actions-gh-vs-github).

## Installation

```bash
npm install --save-dev @reporters/gh
```
or
```bash
yarn add --dev @reporters/gh
```

## Usage

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: node --test --test-reporter=@reporters/gh
```

The same command also works locally — when not running in GitHub Actions it just prints the spec-style log (no annotations):

```bash
node --test --test-reporter=@reporters/gh
```

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

