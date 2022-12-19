# Junit Reporter
A Junit reporter for `node:test`

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