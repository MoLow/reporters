[![npm version](https://img.shields.io/npm/v/@reporters/github)](https://www.npmjs.com/package/@reporters/github) ![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# Github Actions Reporter
A Github actions reporter for `node:test`
 
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

