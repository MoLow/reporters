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

when test failed, you can see the result as an annotation on the failed line.

<img width="810" alt="Screen Shot 2022-12-20 at 3 40 36" src="https://user-images.githubusercontent.com/8221854/208561892-28b821b1-1771-4063-baa2-6e14186ae3bf.png">

additionally, this reporter will add a summary of the tests to the github action.

<img width="815" alt="Screen Shot 2022-12-20 at 3 43 47" src="https://user-images.githubusercontent.com/8221854/208561887-c3eccbd8-7506-4a8f-a18c-2892605f3243.png">

