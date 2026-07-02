# Changelog

## [2.0.2](https://github.com/MoLow/reporters/compare/slow-v2.0.1...slow-v2.0.2) (2026-07-02)


### Documentation

* flag-order fixes and the gh collapsible actions log ([#216](https://github.com/MoLow/reporters/issues/216)) ([131f410](https://github.com/MoLow/reporters/commit/131f4107712d6d0b899d3b8ca7a39496b6e05276))
* rewrite package READMEs with demos and clearer positioning ([#209](https://github.com/MoLow/reporters/issues/209)) ([e1265e5](https://github.com/MoLow/reporters/commit/e1265e5f6b8a0f34b80ef7ee725cede4ed16b6da))


### Miscellaneous Chores

* route this repo's tests through @reporters/mux ([#207](https://github.com/MoLow/reporters/issues/207)) ([85a5973](https://github.com/MoLow/reporters/commit/85a59737bc3d631b0293edf343b77fd82e0c459d))
* run the whole test suite through one root node --test invocation ([#213](https://github.com/MoLow/reporters/issues/213)) ([a144243](https://github.com/MoLow/reporters/commit/a1442430f005ae9638cab04b1801be944a693c36))

## [2.0.1](https://github.com/MoLow/reporters/compare/slow-v2.0.0...slow-v2.0.1) (2026-06-02)


### Miscellaneous Chores

* update snapshots ([#184](https://github.com/MoLow/reporters/issues/184)) ([7717fde](https://github.com/MoLow/reporters/commit/7717fde479f6dd41bb2a11efb75e9d7c3a9712ee))

## [2.0.0](https://github.com/MoLow/reporters/compare/slow-v1.1.1...slow-v2.0.0) (2026-05-24)


### ⚠ BREAKING CHANGES

* packages are now ESM-only. CommonJS consumers require Node.js >=22 (for require(esm)); reporters loaded via Node's --test-reporter flag continue to work on all supported versions.

### Features

* convert packages to ESM, upgrade Node and Yarn ([d4cd2eb](https://github.com/MoLow/reporters/commit/d4cd2ebcd9d1f700d297768f937519079da17ec0))

## [1.1.1](https://github.com/MoLow/reporters/compare/slow-v1.1.0...slow-v1.1.1) (2025-08-06)


### Miscellaneous Chores

* **gh:** rename github-spec to gh ([#140](https://github.com/MoLow/reporters/issues/140)) ([0c50f28](https://github.com/MoLow/reporters/commit/0c50f2893236a5e841683c99ca61269c19f56d5e))

## [1.1.0](https://github.com/MoLow/reporters/compare/slow-v1.0.3...slow-v1.1.0) (2025-08-06)


### Features

* **github-spec:** new combined reporter ([#136](https://github.com/MoLow/reporters/issues/136)) ([17a051f](https://github.com/MoLow/reporters/commit/17a051f4b4a23ad5f2e19aae58c3803970f7ba47))

## [1.0.3](https://github.com/MoLow/reporters/compare/slow-v1.0.2...slow-v1.0.3) (2024-12-10)


### Miscellaneous Chores

* fix typos ([a421b9a](https://github.com/MoLow/reporters/commit/a421b9a8b2c78d9df6816994160e5b8d25914b77))

## [1.0.2](https://github.com/MoLow/reporters/compare/slow-v1.0.1...slow-v1.0.2) (2024-09-10)


### Tests

* use human readable snapshots ([#127](https://github.com/MoLow/reporters/issues/127)) ([cc7d3ba](https://github.com/MoLow/reporters/commit/cc7d3baa7b054f82a5580dfe4151d4eb3c9e8dd5))

## [1.0.1](https://github.com/MoLow/reporters/compare/slow-v1.0.0...slow-v1.0.1) (2024-03-14)


### Tests

* migrate snapshots to snap ([#114](https://github.com/MoLow/reporters/issues/114)) ([1d3ca6a](https://github.com/MoLow/reporters/commit/1d3ca6ad12b4abb5c47adc775b47c205a4214e0a))

## 1.0.0 (2024-01-04)


### Features

* add slow tests reporter ([#105](https://github.com/MoLow/reporters/issues/105)) ([591db4a](https://github.com/MoLow/reporters/commit/591db4a7f4e71b675b1689a2a2ce4ead529db28a))
