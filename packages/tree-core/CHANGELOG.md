# Changelog

## 1.0.0 (2026-07-27)


### Features

* carried-over (rerun) test annotation in the web viewer ([#242](https://github.com/MoLow/reporters/issues/242)) ([da83597](https://github.com/MoLow/reporters/commit/da83597a6c1b11c88bed808658863ff40064625a))
* live and web tree reporters ([#193](https://github.com/MoLow/reporters/issues/193)) ([0fae33e](https://github.com/MoLow/reporters/commit/0fae33e3c87f3a28d68b783a457ef9638cec2f17))
* **tree-core:** keep failureType and code on the wire error ([#265](https://github.com/MoLow/reporters/issues/265)) ([820f709](https://github.com/MoLow/reporters/commit/820f709b857cb1a15d5263da50477fc9f8ce45af))
* **tree-core:** publish @reporters/tree-core to npm ([#270](https://github.com/MoLow/reporters/issues/270)) ([38133fd](https://github.com/MoLow/reporters/commit/38133fd7b9eb796a26bf15a5e2feb923d36a7969))
* **tree-core:** report a passing todo as passed, reserving todo for failing ones ([#227](https://github.com/MoLow/reporters/issues/227)) ([46a9c87](https://github.com/MoLow/reporters/commit/46a9c874d88b2ae68aff80b50b286ea5e11e2a45))


### Bug Fixes

* **tree-core,web:** keep still-running parents and open file wrappers marked running ([#246](https://github.com/MoLow/reporters/issues/246)) ([f4be82d](https://github.com/MoLow/reporters/commit/f4be82db6c708c1d43c466a186d6b6219a096120))
* **tree-core,web:** never hide a container's own error ([#256](https://github.com/MoLow/reporters/issues/256)) ([e5c587d](https://github.com/MoLow/reporters/commit/e5c587dba3d2bfc5e2ce6c6108d2fcce3105163c))
* **tree-core,web:** surface a file wrapper's own failure ([#252](https://github.com/MoLow/reporters/issues/252)) ([faf5f76](https://github.com/MoLow/reporters/commit/faf5f7605cf2ab63695261ea9c6cb5f986620b2c))
* **tree-core:** attach helper-file subtests to their real, still-open parent ([#212](https://github.com/MoLow/reporters/issues/212)) ([b572d76](https://github.com/MoLow/reporters/commit/b572d766033a4de086cba89c17cebc5cbacdb57c))
* **tree-core:** carry duration rounding into the next unit ([#220](https://github.com/MoLow/reporters/issues/220)) ([7f50104](https://github.com/MoLow/reporters/commit/7f50104cf144437133cb34b6fdb803db53f264d4))
* **tree-core:** carry extra error props onto the wire stack ([#257](https://github.com/MoLow/reporters/issues/257)) ([deec348](https://github.com/MoLow/reporters/commit/deec3483dfbe050f411f8b841564d983d0d5f2d0))
* **tree-core:** fall back to the stack first line when a cause message is empty ([#268](https://github.com/MoLow/reporters/issues/268)) ([f44a666](https://github.com/MoLow/reporters/commit/f44a666a459d6d82878a1023f701ff28103d9d91))
* **tree-core:** group top-level stdout/stderr with their file's tests ([#200](https://github.com/MoLow/reporters/issues/200)) ([27a510d](https://github.com/MoLow/reporters/commit/27a510deb42a85de9a82782e85e84b68477599ea))
* **tree-core:** let terminal events demote a wrong suite type hint ([#228](https://github.com/MoLow/reporters/issues/228)) ([b26c4b8](https://github.com/MoLow/reporters/commit/b26c4b87f6a5057311c833c86871384f5568d208))
* **tree-core:** match native spec ordering — decl-ordered siblings, wrapper-ordered files ([#234](https://github.com/MoLow/reporters/issues/234)) ([664a78a](https://github.com/MoLow/reporters/commit/664a78a33de4a9276225a2ae7b1926942a608407))
* **tree-core:** park helper subtests under their group when parentId is ambiguous ([#241](https://github.com/MoLow/reporters/issues/241)) ([85df879](https://github.com/MoLow/reporters/commit/85df8797a7f7c065994a24298282601416ee063d))
* **tree-core:** resolve cross-process testId collisions under --test isolation ([#224](https://github.com/MoLow/reporters/issues/224)) ([a17d562](https://github.com/MoLow/reporters/commit/a17d56236d9e8c5c020c05cde1b9e9c79a149e6d))
* **tree-core:** use \0 escape instead of a raw NUL byte in store.ts ([#226](https://github.com/MoLow/reporters/issues/226)) ([6274a27](https://github.com/MoLow/reporters/commit/6274a27fc9b099947a26411a70326d407aaab2f2))
* **web:** show real wall-clock durations instead of summing concurrent tests ([#225](https://github.com/MoLow/reporters/issues/225)) ([e80ad8b](https://github.com/MoLow/reporters/commit/e80ad8b55a9c3b3aa2317763487f4185a0a5d9cf))
* **web:** true live durations via writer stamps on the wire ([#237](https://github.com/MoLow/reporters/issues/237)) ([42d5478](https://github.com/MoLow/reporters/commit/42d5478d153de83d8f457fb8783794a5aed54408))


### Documentation

* rewrite package READMEs with demos and clearer positioning ([#209](https://github.com/MoLow/reporters/issues/209)) ([e1265e5](https://github.com/MoLow/reporters/commit/e1265e5f6b8a0f34b80ef7ee725cede4ed16b6da))


### Miscellaneous Chores

* address review feedback on the tree reporters ([#194](https://github.com/MoLow/reporters/issues/194)) ([fada74a](https://github.com/MoLow/reporters/commit/fada74aa9be27f1a0a2f217de0115c5ae8de4851))
* route this repo's tests through @reporters/mux ([#207](https://github.com/MoLow/reporters/issues/207)) ([85a5973](https://github.com/MoLow/reporters/commit/85a59737bc3d631b0293edf343b77fd82e0c459d))
* use the gh reporter for tree-core/live/web tests ([#198](https://github.com/MoLow/reporters/issues/198)) ([cc1fefa](https://github.com/MoLow/reporters/commit/cc1fefa5e4f9d04eda6067c4134a83b4cf46aa4f))


### Tests

* **tree-core:** cover slack-reporter suite edge cases ([#210](https://github.com/MoLow/reporters/issues/210)) ([cba43a7](https://github.com/MoLow/reporters/commit/cba43a72d364b3fdf69d4e85ffe579911619d0b0))
