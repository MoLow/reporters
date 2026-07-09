# Changelog

## [2.1.0](https://github.com/MoLow/reporters/compare/web-v2.0.0...web-v2.1.0) (2026-07-09)


### Features

* **web:** export the viewer as a React component ([#264](https://github.com/MoLow/reporters/issues/264)) ([fe5f398](https://github.com/MoLow/reporters/commit/fe5f39816825de31753aa5a37c35f0f47d8548c9))
* **web:** renderHeaderActions slot; node actions before row indicators ([#262](https://github.com/MoLow/reporters/issues/262)) ([26f948a](https://github.com/MoLow/reporters/commit/26f948a64032038db403ad45b021ad10cba81d1a))

## [2.0.0](https://github.com/MoLow/reporters/compare/web-v1.6.2...web-v2.0.0) (2026-07-08)


### ⚠ BREAKING CHANGES

* **web:** the @reporters/web/viewer ESM entry no longer inlines React — react and react-dom are now (optional) peer dependencies, so the host page's TSX and the viewer share one React 19 instance. The standalone viewer page is unchanged (still fully self-contained).

### Features

* **web:** renderNodeActions — embedder TSX per tree row ([#259](https://github.com/MoLow/reporters/issues/259)) ([6911f07](https://github.com/MoLow/reporters/commit/6911f07e1081f51de7f40b10474c661601fdb9ec))


### Bug Fixes

* **web:** stop rebuilding ANSI line DOM on every live re-render ([#261](https://github.com/MoLow/reporters/issues/261)) ([1eb3321](https://github.com/MoLow/reporters/commit/1eb33215e533dac6a840f6ee37854b00921383e1))

## [1.6.2](https://github.com/MoLow/reporters/compare/web-v1.6.1...web-v1.6.2) (2026-07-08)


### Bug Fixes

* **tree-core:** carry extra error props onto the wire stack ([#257](https://github.com/MoLow/reporters/issues/257)) ([deec348](https://github.com/MoLow/reporters/commit/deec3483dfbe050f411f8b841564d983d0d5f2d0))

## [1.6.1](https://github.com/MoLow/reporters/compare/web-v1.6.0...web-v1.6.1) (2026-07-07)


### Bug Fixes

* **tree-core,web:** never hide a container's own error ([#256](https://github.com/MoLow/reporters/issues/256)) ([e5c587d](https://github.com/MoLow/reporters/commit/e5c587dba3d2bfc5e2ce6c6108d2fcce3105163c))
* **web:** allow selecting text in the viewer ([#255](https://github.com/MoLow/reporters/issues/255)) ([aafe3c6](https://github.com/MoLow/reporters/commit/aafe3c6cc996e1b79c37ea09fd200292a837fea2))
* **web:** show the loading state before filters can declare no matches ([#253](https://github.com/MoLow/reporters/issues/253)) ([29f0f11](https://github.com/MoLow/reporters/commit/29f0f11566bff591608ff9e38ff81b719c47d4d2))

## [1.6.0](https://github.com/MoLow/reporters/compare/web-v1.5.2...web-v1.6.0) (2026-07-07)


### Features

* **web:** persist filters in the URL for shareable views ([#251](https://github.com/MoLow/reporters/issues/251)) ([2ad21ab](https://github.com/MoLow/reporters/commit/2ad21ab7ab8a702c8b73e2962b29a14050d2c6e4))


### Bug Fixes

* **tree-core,web:** surface a file wrapper's own failure ([#252](https://github.com/MoLow/reporters/issues/252)) ([faf5f76](https://github.com/MoLow/reporters/commit/faf5f7605cf2ab63695261ea9c6cb5f986620b2c))
* **web:** let the status filter match a still-running parent ([#249](https://github.com/MoLow/reporters/issues/249)) ([b8d5141](https://github.com/MoLow/reporters/commit/b8d514101abc785b92237f3162eda906496af575))

## [1.5.2](https://github.com/MoLow/reporters/compare/web-v1.5.1...web-v1.5.2) (2026-07-06)


### Bug Fixes

* **tree-core,web:** keep still-running parents and open file wrappers marked running ([#246](https://github.com/MoLow/reporters/issues/246)) ([f4be82d](https://github.com/MoLow/reporters/commit/f4be82db6c708c1d43c466a186d6b6219a096120))

## [1.5.1](https://github.com/MoLow/reporters/compare/web-v1.5.0...web-v1.5.1) (2026-07-06)


### Bug Fixes

* **web:** one consistent stat-chip tooltip format ([#244](https://github.com/MoLow/reporters/issues/244)) ([42d189a](https://github.com/MoLow/reporters/commit/42d189a53ca1f60f6925dec49d8c2f44108869d7))

## [1.5.0](https://github.com/MoLow/reporters/compare/web-v1.4.1...web-v1.5.0) (2026-07-06)


### Features

* carried-over (rerun) test annotation in the web viewer ([#242](https://github.com/MoLow/reporters/issues/242)) ([da83597](https://github.com/MoLow/reporters/commit/da83597a6c1b11c88bed808658863ff40064625a))
* **web:** mobile-friendly viewer layout and header polish ([#239](https://github.com/MoLow/reporters/issues/239)) ([61de320](https://github.com/MoLow/reporters/commit/61de320597de08f76290a840fc195bed9f5d08d5))
* **web:** shared body-level tooltip engine and full tooltip coverage ([#243](https://github.com/MoLow/reporters/issues/243)) ([1b63da1](https://github.com/MoLow/reporters/commit/1b63da13900352105274856babb5e1c474c43be5))

## [1.4.1](https://github.com/MoLow/reporters/compare/web-v1.4.0...web-v1.4.1) (2026-07-06)


### Bug Fixes

* **web:** true live durations via writer stamps on the wire ([#237](https://github.com/MoLow/reporters/issues/237)) ([42d5478](https://github.com/MoLow/reporters/commit/42d5478d153de83d8f457fb8783794a5aed54408))

## [1.4.0](https://github.com/MoLow/reporters/compare/web-v1.3.0...web-v1.4.0) (2026-07-06)


### Features

* **tree-core:** report a passing todo as passed, reserving todo for failing ones ([#227](https://github.com/MoLow/reporters/issues/227)) ([46a9c87](https://github.com/MoLow/reporters/commit/46a9c874d88b2ae68aff80b50b286ea5e11e2a45))
* **web:** bounded log viewer — capped panels, full-log modal, named affordances ([#233](https://github.com/MoLow/reporters/issues/233)) ([f30d492](https://github.com/MoLow/reporters/commit/f30d49254394fb97f820b9202c055cd78b815000))
* **web:** clickable header status chips filter the tree ([#231](https://github.com/MoLow/reporters/issues/231)) ([bdf4f4e](https://github.com/MoLow/reporters/commit/bdf4f4e8efd3e8c03fe2c458a83d1d637b592f5f))
* **web:** distinct loading state before the first log fetch resolves ([#235](https://github.com/MoLow/reporters/issues/235)) ([5d1eb6c](https://github.com/MoLow/reporters/commit/5d1eb6ca77b3447a3304d8fc655eaf3a33d1c27f))
* **web:** richer diagnostics rendering in the viewer ([#232](https://github.com/MoLow/reporters/issues/232)) ([b7eb565](https://github.com/MoLow/reporters/commit/b7eb56506e5776a4231aef631a857512800df3ea))


### Bug Fixes

* **web:** keep the http server alive until the viewer reads the whole log ([#230](https://github.com/MoLow/reporters/issues/230)) ([ba7de4d](https://github.com/MoLow/reporters/commit/ba7de4d8035afb5ec4bece56b737cce607d0fa2c))
* **web:** show real wall-clock durations instead of summing concurrent tests ([#225](https://github.com/MoLow/reporters/issues/225)) ([e80ad8b](https://github.com/MoLow/reporters/commit/e80ad8b55a9c3b3aa2317763487f4185a0a5d9cf))

## [1.3.0](https://github.com/MoLow/reporters/compare/web-v1.2.0...web-v1.3.0) (2026-07-02)


### Features

* pluggable viewer report sources and custom s3 viewer links ([#222](https://github.com/MoLow/reporters/issues/222)) ([e553e89](https://github.com/MoLow/reporters/commit/e553e89a6e0c9ba9323483ca52a3142c8e70f8ce))

## [1.2.0](https://github.com/MoLow/reporters/compare/web-v1.1.0...web-v1.2.0) (2026-07-02)


### Features

* **web:** let sinks set the viewer poll cadence via a poll query param ([#219](https://github.com/MoLow/reporters/issues/219)) ([a78404d](https://github.com/MoLow/reporters/commit/a78404d61cf924d0c8e221ee41b8b0337f3d1023))


### Bug Fixes

* **web:** stay a pure emitter under mux via symbol-declared default options ([#217](https://github.com/MoLow/reporters/issues/217)) ([96a7d14](https://github.com/MoLow/reporters/commit/96a7d14e82f69c6dc6d8d363645f94c09733fbda))

## [1.1.0](https://github.com/MoLow/reporters/compare/web-v1.0.0...web-v1.1.0) (2026-07-02)


### Features

* @reporters/mux environment-aware reporter routing + web NDJSON redesign ([#203](https://github.com/MoLow/reporters/issues/203)) ([82d1e20](https://github.com/MoLow/reporters/commit/82d1e205949e6daa90b13aec5838ddb0c7e931a5))
* live and web tree reporters ([#193](https://github.com/MoLow/reporters/issues/193)) ([0fae33e](https://github.com/MoLow/reporters/commit/0fae33e3c87f3a28d68b783a457ef9638cec2f17))
* **web:** implement the Panel design for the web report & live viewer ([#195](https://github.com/MoLow/reporters/issues/195)) ([f93b76b](https://github.com/MoLow/reporters/commit/f93b76bb8536adda53d57b7691b8912c86208cee))
* **web:** read destination from execArgv; auto-open the report locally ([#197](https://github.com/MoLow/reporters/issues/197)) ([d8eb056](https://github.com/MoLow/reporters/commit/d8eb056c117b1a35120dc9e898b600ff853d43bb))
* **web:** render ANSI colors in the report (fancy-ansi) ([#206](https://github.com/MoLow/reporters/issues/206)) ([a2c938e](https://github.com/MoLow/reporters/commit/a2c938e2d2ada1ecd0f2aea636c253e619dd084a))
* **web:** replace density toggle with a dark/light mode toggle ([#202](https://github.com/MoLow/reporters/issues/202)) ([47fbf7c](https://github.com/MoLow/reporters/commit/47fbf7c180dd7383d31eda75061631b41fc5c060))
* **web:** viewer design round 2 + live-viewer transition choreography ([#205](https://github.com/MoLow/reporters/issues/205)) ([b99d9c6](https://github.com/MoLow/reporters/commit/b99d9c62b4729a530922e18a2b4566ed219bd9a5))


### Bug Fixes

* **tree-core:** group top-level stdout/stderr with their file's tests ([#200](https://github.com/MoLow/reporters/issues/200)) ([27a510d](https://github.com/MoLow/reporters/commit/27a510deb42a85de9a82782e85e84b68477599ea))
* **web:** auto-refresh the embedded report while streaming ([#196](https://github.com/MoLow/reporters/issues/196)) ([68090dc](https://github.com/MoLow/reporters/commit/68090dc3fbade1b2f01bba150310b9263aa0336c))
* **web:** honor REPORTERS_OPEN instead of REPORTERS_WEB_OPEN ([#208](https://github.com/MoLow/reporters/issues/208)) ([fe3716d](https://github.com/MoLow/reporters/commit/fe3716d499cf8ab592c66d7519fce8c9c50ae060))
* **web:** open the standalone live view even without a file destination ([#204](https://github.com/MoLow/reporters/issues/204)) ([cf6d465](https://github.com/MoLow/reporters/commit/cf6d4657efee5fdb6a5daa63e2be475be27bcab2))
* **web:** use the live viewer URL in the load-error hint ([#201](https://github.com/MoLow/reporters/issues/201)) ([acf6dec](https://github.com/MoLow/reporters/commit/acf6dec6701c8b42d98ab703fdd74965c7d94aff))


### Documentation

* flag-order fixes and the gh collapsible actions log ([#216](https://github.com/MoLow/reporters/issues/216)) ([131f410](https://github.com/MoLow/reporters/commit/131f4107712d6d0b899d3b8ca7a39496b6e05276))
* rewrite package READMEs with demos and clearer positioning ([#209](https://github.com/MoLow/reporters/issues/209)) ([e1265e5](https://github.com/MoLow/reporters/commit/e1265e5f6b8a0f34b80ef7ee725cede4ed16b6da))


### Miscellaneous Chores

* address review feedback on the tree reporters ([#194](https://github.com/MoLow/reporters/issues/194)) ([fada74a](https://github.com/MoLow/reporters/commit/fada74aa9be27f1a0a2f217de0115c5ae8de4851))
* route this repo's tests through @reporters/mux ([#207](https://github.com/MoLow/reporters/issues/207)) ([85a5973](https://github.com/MoLow/reporters/commit/85a59737bc3d631b0293edf343b77fd82e0c459d))
* use the gh reporter for tree-core/live/web tests ([#198](https://github.com/MoLow/reporters/issues/198)) ([cc1fefa](https://github.com/MoLow/reporters/commit/cc1fefa5e4f9d04eda6067c4134a83b4cf46aa4f))
