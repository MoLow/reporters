# Changelog

## [1.1.0](https://github.com/MoLow/reporters/compare/sink-v1.0.0...sink-v1.1.0) (2026-07-02)


### Features

* **mux:** start every sink before reporters consume events ([#221](https://github.com/MoLow/reporters/issues/221)) ([c5ef14f](https://github.com/MoLow/reporters/commit/c5ef14fbe0357a4f756fb170f69876396806abd6))
* **web:** let sinks set the viewer poll cadence via a poll query param ([#219](https://github.com/MoLow/reporters/issues/219)) ([a78404d](https://github.com/MoLow/reporters/commit/a78404d61cf924d0c8e221ee41b8b0337f3d1023))

## 1.0.0 (2026-07-02)


### Features

* @reporters/sink — gist + s3 delivery sinks for viewing CI runs ([#211](https://github.com/MoLow/reporters/issues/211)) ([4b254b6](https://github.com/MoLow/reporters/commit/4b254b629236393b25c5903a976dbebfaf5ebc1a))


### Bug Fixes

* **sink:** back off and retry failed uploads instead of giving up ([#215](https://github.com/MoLow/reporters/issues/215)) ([8e1cdfe](https://github.com/MoLow/reporters/commit/8e1cdfe1d46438b01a0481f59290d5b8e177efcd))
* **sink:** never fail the run when uploading the report fails ([#214](https://github.com/MoLow/reporters/issues/214)) ([2e7df86](https://github.com/MoLow/reporters/commit/2e7df8670eba81c74356011d253c2ce72fb5a6f8))


### Documentation

* rewrite package READMEs with demos and clearer positioning ([#209](https://github.com/MoLow/reporters/issues/209)) ([e1265e5](https://github.com/MoLow/reporters/commit/e1265e5f6b8a0f34b80ef7ee725cede4ed16b6da))
