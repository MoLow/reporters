# Changelog

## [1.12.0](https://github.com/MoLow/reporters/compare/github-v1.11.3...github-v1.12.0) (2026-01-28)


### Features

* add location to notify ([#111](https://github.com/MoLow/reporters/issues/111)) ([e63d34a](https://github.com/MoLow/reporters/commit/e63d34a5b4fb040a4cb63d4db15c87d4128e7c4c))
* add mocha reporter ([#116](https://github.com/MoLow/reporters/issues/116)) ([90ef449](https://github.com/MoLow/reporters/commit/90ef4490665e19cab1ceebf8a77e78b54e38f668))
* **gh:** nicer output for duration in summary ([#154](https://github.com/MoLow/reporters/issues/154)) ([f03c0dd](https://github.com/MoLow/reporters/commit/f03c0dd6d3c90fffab4fcf06b1d631cdf275de08))
* **github-spec:** new combined reporter ([#136](https://github.com/MoLow/reporters/issues/136)) ([17a051f](https://github.com/MoLow/reporters/commit/17a051f4b4a23ad5f2e19aae58c3803970f7ba47))
* nicer error messages in GitHub Actions ([#150](https://github.com/MoLow/reporters/issues/150)) ([c6f942b](https://github.com/MoLow/reporters/commit/c6f942b78beb7b19a51d1a1d57e4274e47f1a3c5))
* publish with provenance ([6ee1e46](https://github.com/MoLow/reporters/commit/6ee1e46040329edeb0f40f753093b6952984f001))
* remove redundant subtests annotation ([6f22533](https://github.com/MoLow/reporters/commit/6f2253378c7ecdcbb5c38aac77dfd13b1662e0d6))
* report node 20 features ([c99a76c](https://github.com/MoLow/reporters/commit/c99a76c0f6bef75abb2c053c82c88448b0c82690))
* silence diagnostics ([#135](https://github.com/MoLow/reporters/issues/135)) ([6f43c3d](https://github.com/MoLow/reporters/commit/6f43c3d666a59abbac1f54dbf7c61c6bcc71c854))
* support node 18 ([02c8957](https://github.com/MoLow/reporters/commit/02c8957ffca3cb8376f7ad5a94f4627c70b7f8e5))
* use reported file ([#30](https://github.com/MoLow/reporters/issues/30)) ([4c70922](https://github.com/MoLow/reporters/commit/4c709222734de88af71c5a086622c3b022d51fd5))


### Bug Fixes

* add support for esm ([e31f5d5](https://github.com/MoLow/reporters/commit/e31f5d598e44c8e167a33cc3e97571d4402d09dd))
* allow multiple roots ([590df94](https://github.com/MoLow/reporters/commit/590df948f8a4626fc29e8ce185e08d2226a307ba))
* **deps:** upgrade @actions/core to version 2.0.3 ([#158](https://github.com/MoLow/reporters/issues/158)) ([e26e326](https://github.com/MoLow/reporters/commit/e26e32672a4fd2b6a922c7983baef6b0dcf3f9b2))
* fix monorepos release ([8386ef0](https://github.com/MoLow/reporters/commit/8386ef0ea7bfe0c0325e171aa7122eeccb17bad3))
* fix monorepos release ([3c5ee61](https://github.com/MoLow/reporters/commit/3c5ee6126fe961363b3feccf1ba6594a0849855b))
* fix monorepos release ([7eebffb](https://github.com/MoLow/reporters/commit/7eebffb46ab627beaa2b10023a08dd3271f819e9))
* fix monorepos release ([9c66f37](https://github.com/MoLow/reporters/commit/9c66f37b010f782e70c3cdf2bf827d30c4aa71c2))
* fix monorepos release ([d844919](https://github.com/MoLow/reporters/commit/d844919c8684216155b8f1c0acc98d907b3a5cdb))
* fix monorepos release ([d5610e2](https://github.com/MoLow/reporters/commit/d5610e29db730dc4ffa3f9721a85d5f3c7749b2c))
* fix monorepos release ([6126b97](https://github.com/MoLow/reporters/commit/6126b972670fdbb0ecf71c996790e0f11fda5f21))
* fix package description ([cec07c7](https://github.com/MoLow/reporters/commit/cec07c70d37b3ed43947b17312a6bd58f095510f))
* fix typo ([#22](https://github.com/MoLow/reporters/issues/22)) ([0308fac](https://github.com/MoLow/reporters/commit/0308fac968799a0fd877460deeaa5503bc53d09f))
* **gh:** fix error grouping issues ([#144](https://github.com/MoLow/reporters/issues/144)) ([13bf329](https://github.com/MoLow/reporters/commit/13bf3296621a1d2cf3131a7b33e9c2cf9d661e76))
* **github:** add missing file ([#146](https://github.com/MoLow/reporters/issues/146)) ([5d302bb](https://github.com/MoLow/reporters/commit/5d302bb7abe1d20b447c9c8881aecb5945efdc95))
* **github:** correctly convert `file:` URL to path ([#131](https://github.com/MoLow/reporters/issues/131)) ([31843fc](https://github.com/MoLow/reporters/commit/31843fce34c9e4811f600113bcc6c70775b637c3))
* **github:** remove redundant diagnostics ([b62df32](https://github.com/MoLow/reporters/commit/b62df3280b141af763386a68b0b4e386bef907e7))
* **github:** silent if not running on github actions ([#33](https://github.com/MoLow/reporters/issues/33)) ([a480454](https://github.com/MoLow/reporters/commit/a480454ac7ca0471744ec00b69a6c67a1d3c8ada))
* line reporting for ERR_TEST_FAILURE ([4fb29f3](https://github.com/MoLow/reporters/commit/4fb29f3fb8a470af8d1a9549adc7d91f465cad91))
* more accurate counting ([1949140](https://github.com/MoLow/reporters/commit/19491406b769f03555b3ae352ed9838e2154c855))
* remove diagnostics from summary ([#113](https://github.com/MoLow/reporters/issues/113)) ([1e95cf0](https://github.com/MoLow/reporters/commit/1e95cf0bab16785073715238b42b9fb8baebbc43))
* reset changelogs ([1e114ce](https://github.com/MoLow/reporters/commit/1e114ced7201cf9897f2cf79b5a4fb46f1b085fb))
* some package.json links ([c51a616](https://github.com/MoLow/reporters/commit/c51a61648e29f5baca539ded1b09c2af3f5e0a4a))
* stacktrace misslocated ([33068bf](https://github.com/MoLow/reporters/commit/33068bf98f53f7d6d28678b63d58b4c9b04d8ece))
* **test:** update tests ([#106](https://github.com/MoLow/reporters/issues/106)) ([8c09454](https://github.com/MoLow/reporters/commit/8c09454aeefe41e10f9466fc593ff80408d06c8a))


### Documentation

* add codecov badge ([99bedc8](https://github.com/MoLow/reporters/commit/99bedc8057c51730f77e6497099f81a3df492231))
* improve docs ([244acd6](https://github.com/MoLow/reporters/commit/244acd694c9b41803c46f8694741ac30971a39ed))
* update screenshots ([0913bf3](https://github.com/MoLow/reporters/commit/0913bf37ce83a0a240c0f28b59a1647741212612))


### Miscellaneous Chores

* add "type" to package.json ([d8567bd](https://github.com/MoLow/reporters/commit/d8567bdd2a415919dba6ba652d2e33dc233426ce))
* eslint fixes ([3100c40](https://github.com/MoLow/reporters/commit/3100c40ffe3a3e63afb05991f07bf8dbc23efbc9))
* fix codecov reporting ([#39](https://github.com/MoLow/reporters/issues/39)) ([e4dfd36](https://github.com/MoLow/reporters/commit/e4dfd36065dac13f94fc4c3eacae3d298c5f0a21))
* fix typos ([a421b9a](https://github.com/MoLow/reporters/commit/a421b9a8b2c78d9df6816994160e5b8d25914b77))
* **gh:** rename github-spec to gh ([#140](https://github.com/MoLow/reporters/issues/140)) ([0c50f28](https://github.com/MoLow/reporters/commit/0c50f2893236a5e841683c99ca61269c19f56d5e))
* release main ([8b93b60](https://github.com/MoLow/reporters/commit/8b93b609ff4d68ee8424551a1b112de92d14fbe0))
* release main ([765eed1](https://github.com/MoLow/reporters/commit/765eed1ec32a9d94998f43ee6676a98077964eb0))
* release main ([d64e13b](https://github.com/MoLow/reporters/commit/d64e13b706fba3a396f9c869232c6eb1568bfa8d))
* release main ([e888a73](https://github.com/MoLow/reporters/commit/e888a7317bc60fecb454893cd361adc0de5e01e8))
* release main ([62a2b74](https://github.com/MoLow/reporters/commit/62a2b7426dc8577ad430a47a5d6693fcf6530e1d))
* release main ([b465203](https://github.com/MoLow/reporters/commit/b465203effdffb41fb222b5343e79c7b16f01293))
* release main ([19cbf19](https://github.com/MoLow/reporters/commit/19cbf1953878bc93ae6cbba20e3cb4e77d22f88a))
* release main ([8775b1f](https://github.com/MoLow/reporters/commit/8775b1f8368c8a328a636fe135a04f64b580fd39))
* release main ([#10](https://github.com/MoLow/reporters/issues/10)) ([dab32bb](https://github.com/MoLow/reporters/commit/dab32bb22bfa8f7cc8199d9e93634cc73c85af2a))
* release main ([#104](https://github.com/MoLow/reporters/issues/104)) ([6cd3790](https://github.com/MoLow/reporters/commit/6cd3790e73525ce892aa1c6c1378bbf7661a6714))
* release main ([#107](https://github.com/MoLow/reporters/issues/107)) ([3537ebf](https://github.com/MoLow/reporters/commit/3537ebf59fb254d0abd17c78a7a57ee8cd83d968))
* release main ([#112](https://github.com/MoLow/reporters/issues/112)) ([aa2a482](https://github.com/MoLow/reporters/commit/aa2a482b14bfe4f64430a3f1ebb8e893b4198705))
* release main ([#115](https://github.com/MoLow/reporters/issues/115)) ([cfd2557](https://github.com/MoLow/reporters/commit/cfd2557fd3fd668e62c458859bcc1291c60b0fe2))
* release main ([#126](https://github.com/MoLow/reporters/issues/126)) ([9153b06](https://github.com/MoLow/reporters/commit/9153b06a66afdc397a2365668d1f872860b01ffe))
* release main ([#13](https://github.com/MoLow/reporters/issues/13)) ([4334961](https://github.com/MoLow/reporters/commit/4334961ad6a772197fef329a7b6e171a15700aae))
* release main ([#130](https://github.com/MoLow/reporters/issues/130)) ([d0a2c8b](https://github.com/MoLow/reporters/commit/d0a2c8bbf586a20673d7a8128879c13dc2d131c8))
* release main ([#134](https://github.com/MoLow/reporters/issues/134)) ([a851f42](https://github.com/MoLow/reporters/commit/a851f42567f5e64a2797dc8778a3819988359077))
* release main ([#137](https://github.com/MoLow/reporters/issues/137)) ([9b61f75](https://github.com/MoLow/reporters/commit/9b61f75aa43bb062799b91f504a6aec7f220a2fe))
* release main ([#139](https://github.com/MoLow/reporters/issues/139)) ([fc5dfc3](https://github.com/MoLow/reporters/commit/fc5dfc38215e894c4d124da4fb6090bd53097098))
* release main ([#14](https://github.com/MoLow/reporters/issues/14)) ([befd9b7](https://github.com/MoLow/reporters/commit/befd9b7368ed47f26deddad725a5974cfbf28c65))
* release main ([#145](https://github.com/MoLow/reporters/issues/145)) ([46fe651](https://github.com/MoLow/reporters/commit/46fe651c12d97f2a206fa5a6d90a67cea4c0aac2))
* release main ([#147](https://github.com/MoLow/reporters/issues/147)) ([75526f0](https://github.com/MoLow/reporters/commit/75526f0251999f40a06946c4d7370dff63c4f82e))
* release main ([#15](https://github.com/MoLow/reporters/issues/15)) ([f90c51a](https://github.com/MoLow/reporters/commit/f90c51a16f6b51324dcafd4eab03a940d250a47a))
* release main ([#151](https://github.com/MoLow/reporters/issues/151)) ([9f3775a](https://github.com/MoLow/reporters/commit/9f3775ad43800c23ba2ba6727ee96fe65c4702b8))
* release main ([#155](https://github.com/MoLow/reporters/issues/155)) ([f096bfb](https://github.com/MoLow/reporters/commit/f096bfb256a7614cc847882a278b2149b3256902))
* release main ([#16](https://github.com/MoLow/reporters/issues/16)) ([a88ab7e](https://github.com/MoLow/reporters/commit/a88ab7e345c9dc77b1deef560de7843ccde132dc))
* release main ([#164](https://github.com/MoLow/reporters/issues/164)) ([8ff5c6b](https://github.com/MoLow/reporters/commit/8ff5c6b971718ad00fbd00a1ffe2d1b7586f9de0))
* release main ([#17](https://github.com/MoLow/reporters/issues/17)) ([f67f850](https://github.com/MoLow/reporters/commit/f67f85030af9cb4660f5a8e1cecd644af651257f))
* release main ([#18](https://github.com/MoLow/reporters/issues/18)) ([2a3c480](https://github.com/MoLow/reporters/commit/2a3c480847df31a4bfb6f627029145d9a781ef02))
* release main ([#19](https://github.com/MoLow/reporters/issues/19)) ([c44fbd5](https://github.com/MoLow/reporters/commit/c44fbd586c00e5960d73d417f32baa0b9a9edbd4))
* release main ([#25](https://github.com/MoLow/reporters/issues/25)) ([1e31a7f](https://github.com/MoLow/reporters/commit/1e31a7fd0a6deb92704bdac179b34b2b28299783))
* release main ([#31](https://github.com/MoLow/reporters/issues/31)) ([9f9d24b](https://github.com/MoLow/reporters/commit/9f9d24bfcea77e898144126ef70bec2f868bec34))
* release main ([#34](https://github.com/MoLow/reporters/issues/34)) ([04ceb1b](https://github.com/MoLow/reporters/commit/04ceb1bcec023ce7628b6e9ac95758423c1e9f30))
* release main ([#35](https://github.com/MoLow/reporters/issues/35)) ([142ade8](https://github.com/MoLow/reporters/commit/142ade89787b51afedc97888bf573f7f207dfc5c))
* release main ([#9](https://github.com/MoLow/reporters/issues/9)) ([670f98b](https://github.com/MoLow/reporters/commit/670f98b70c4b2a03c4dc38f94c0ee08ce89926dc))
* report coverage to codecov ([#37](https://github.com/MoLow/reporters/issues/37)) ([2b62f8d](https://github.com/MoLow/reporters/commit/2b62f8d315aa843a36a2dd30a0884bb5a857aefb))
* update snapshots ([#133](https://github.com/MoLow/reporters/issues/133)) ([8a689d2](https://github.com/MoLow/reporters/commit/8a689d2fd4f1d389aceb1825c9ce82c1069f1dc1))
* update snapshots ([#160](https://github.com/MoLow/reporters/issues/160)) ([7ba5ae0](https://github.com/MoLow/reporters/commit/7ba5ae0c43ccc2dcbf12540320519903f6d09545))
* use github reporter in local tests ([#32](https://github.com/MoLow/reporters/issues/32)) ([8e06304](https://github.com/MoLow/reporters/commit/8e06304f85564ed14e1d42ba2860cebce3b81269))
* use node 19 for tests ([#29](https://github.com/MoLow/reporters/issues/29)) ([54638b2](https://github.com/MoLow/reporters/commit/54638b2f868cfe238fe800a312f6169b0341df81))


### Code Refactoring

* use monorepos ([#7](https://github.com/MoLow/reporters/issues/7)) ([804abe1](https://github.com/MoLow/reporters/commit/804abe1facec7a45ca740824c55e2f26d4ccd0b9))


### Tests

* add coverage ([8e90e64](https://github.com/MoLow/reporters/commit/8e90e64958ee4df3b3a60a2fab1f0c85914a295d))
* add tests ([#24](https://github.com/MoLow/reporters/issues/24)) ([fb66142](https://github.com/MoLow/reporters/commit/fb66142268f5909b2ba016f8f05476f21b219aca))
* migrate snapshots to snap ([#114](https://github.com/MoLow/reporters/issues/114)) ([1d3ca6a](https://github.com/MoLow/reporters/commit/1d3ca6ad12b4abb5c47adc775b47c205a4214e0a))
* test skiped tests ([ac02c7f](https://github.com/MoLow/reporters/commit/ac02c7f1323a5e104f6f74e9ed3e85fc04567a34))
* update tests to reflect latest node updates ([#125](https://github.com/MoLow/reporters/issues/125)) ([2849c0f](https://github.com/MoLow/reporters/commit/2849c0f9b57375eb4dc704539fdb331b0b4cd572))
* use core actions ([#21](https://github.com/MoLow/reporters/issues/21)) ([07c0e41](https://github.com/MoLow/reporters/commit/07c0e41a97ee5978759f8641a0ac0e0deb3c6ea7))
* use human readable snapshots ([#127](https://github.com/MoLow/reporters/issues/127)) ([cc7d3ba](https://github.com/MoLow/reporters/commit/cc7d3baa7b054f82a5580dfe4151d4eb3c9e8dd5))
* use node nightly ([#20](https://github.com/MoLow/reporters/issues/20)) ([9e6faa9](https://github.com/MoLow/reporters/commit/9e6faa960f8b71d3c9944709a844170ba7d4562c))


### Build System

* exclude redundant files ([032eb2f](https://github.com/MoLow/reporters/commit/032eb2fbb1520b3c259e2a80eb38280826e206ef))

## [1.11.1](https://github.com/MoLow/reporters/compare/github-v1.11.0...github-v1.11.1) (2026-01-28)


### Bug Fixes

* **deps:** upgrade @actions/core to version 2.0.3 ([#158](https://github.com/MoLow/reporters/issues/158)) ([e26e326](https://github.com/MoLow/reporters/commit/e26e32672a4fd2b6a922c7983baef6b0dcf3f9b2))


### Miscellaneous Chores

* update snapshots ([#160](https://github.com/MoLow/reporters/issues/160)) ([7ba5ae0](https://github.com/MoLow/reporters/commit/7ba5ae0c43ccc2dcbf12540320519903f6d09545))

## [1.11.0](https://github.com/MoLow/reporters/compare/github-v1.10.0...github-v1.11.0) (2025-09-02)


### Features

* **gh:** nicer output for duration in summary ([#154](https://github.com/MoLow/reporters/issues/154)) ([f03c0dd](https://github.com/MoLow/reporters/commit/f03c0dd6d3c90fffab4fcf06b1d631cdf275de08))

## [1.10.0](https://github.com/MoLow/reporters/compare/github-v1.9.3...github-v1.10.0) (2025-08-26)


### Features

* nicer error messages in GitHub Actions ([#150](https://github.com/MoLow/reporters/issues/150)) ([c6f942b](https://github.com/MoLow/reporters/commit/c6f942b78beb7b19a51d1a1d57e4274e47f1a3c5))

## [1.9.3](https://github.com/MoLow/reporters/compare/github-v1.9.2...github-v1.9.3) (2025-08-26)


### Bug Fixes

* **github:** add missing file ([#146](https://github.com/MoLow/reporters/issues/146)) ([5d302bb](https://github.com/MoLow/reporters/commit/5d302bb7abe1d20b447c9c8881aecb5945efdc95))

## [1.9.2](https://github.com/MoLow/reporters/compare/github-v1.9.1...github-v1.9.2) (2025-08-26)


### Bug Fixes

* **gh:** fix error grouping issues ([#144](https://github.com/MoLow/reporters/issues/144)) ([13bf329](https://github.com/MoLow/reporters/commit/13bf3296621a1d2cf3131a7b33e9c2cf9d661e76))

## [1.9.1](https://github.com/MoLow/reporters/compare/github-v1.9.0...github-v1.9.1) (2025-08-06)


### Miscellaneous Chores

* **gh:** rename github-spec to gh ([#140](https://github.com/MoLow/reporters/issues/140)) ([0c50f28](https://github.com/MoLow/reporters/commit/0c50f2893236a5e841683c99ca61269c19f56d5e))

## [1.9.0](https://github.com/MoLow/reporters/compare/github-v1.8.0...github-v1.9.0) (2025-08-06)


### Features

* **github-spec:** new combined reporter ([#136](https://github.com/MoLow/reporters/issues/136)) ([17a051f](https://github.com/MoLow/reporters/commit/17a051f4b4a23ad5f2e19aae58c3803970f7ba47))

## [1.8.0](https://github.com/MoLow/reporters/compare/github-v1.7.2...github-v1.8.0) (2025-07-31)


### Features

* silence diagnostics ([#135](https://github.com/MoLow/reporters/issues/135)) ([6f43c3d](https://github.com/MoLow/reporters/commit/6f43c3d666a59abbac1f54dbf7c61c6bcc71c854))


### Miscellaneous Chores

* update snapshots ([#133](https://github.com/MoLow/reporters/issues/133)) ([8a689d2](https://github.com/MoLow/reporters/commit/8a689d2fd4f1d389aceb1825c9ce82c1069f1dc1))

## [1.7.2](https://github.com/MoLow/reporters/compare/github-v1.7.1...github-v1.7.2) (2024-12-10)


### Bug Fixes

* **github:** correctly convert `file:` URL to path ([#131](https://github.com/MoLow/reporters/issues/131)) ([31843fc](https://github.com/MoLow/reporters/commit/31843fce34c9e4811f600113bcc6c70775b637c3))


### Miscellaneous Chores

* fix typos ([a421b9a](https://github.com/MoLow/reporters/commit/a421b9a8b2c78d9df6816994160e5b8d25914b77))

## [1.7.1](https://github.com/MoLow/reporters/compare/github-v1.7.0...github-v1.7.1) (2024-09-10)


### Tests

* update tests to reflect latest node updates ([#125](https://github.com/MoLow/reporters/issues/125)) ([2849c0f](https://github.com/MoLow/reporters/commit/2849c0f9b57375eb4dc704539fdb331b0b4cd572))
* use human readable snapshots ([#127](https://github.com/MoLow/reporters/issues/127)) ([cc7d3ba](https://github.com/MoLow/reporters/commit/cc7d3baa7b054f82a5580dfe4151d4eb3c9e8dd5))

## [1.7.0](https://github.com/MoLow/reporters/compare/github-v1.6.0...github-v1.7.0) (2024-03-14)


### Features

* add mocha reporter ([#116](https://github.com/MoLow/reporters/issues/116)) ([90ef449](https://github.com/MoLow/reporters/commit/90ef4490665e19cab1ceebf8a77e78b54e38f668))


### Tests

* migrate snapshots to snap ([#114](https://github.com/MoLow/reporters/issues/114)) ([1d3ca6a](https://github.com/MoLow/reporters/commit/1d3ca6ad12b4abb5c47adc775b47c205a4214e0a))

## [1.6.0](https://github.com/MoLow/reporters/compare/github-v1.5.4...github-v1.6.0) (2024-02-01)


### Features

* add location to notify ([#111](https://github.com/MoLow/reporters/issues/111)) ([e63d34a](https://github.com/MoLow/reporters/commit/e63d34a5b4fb040a4cb63d4db15c87d4128e7c4c))


### Bug Fixes

* remove diagnostics from summary ([#113](https://github.com/MoLow/reporters/issues/113)) ([1e95cf0](https://github.com/MoLow/reporters/commit/1e95cf0bab16785073715238b42b9fb8baebbc43))

## [1.5.4](https://github.com/MoLow/reporters/compare/github-v1.5.3...github-v1.5.4) (2024-01-04)


### Bug Fixes

* **test:** update tests ([#106](https://github.com/MoLow/reporters/issues/106)) ([8c09454](https://github.com/MoLow/reporters/commit/8c09454aeefe41e10f9466fc593ff80408d06c8a))

## [1.5.3](https://github.com/MoLow/reporters/compare/github-v1.5.2...github-v1.5.3) (2023-09-26)


### Miscellaneous Chores

* add "type" to package.json ([d8567bd](https://github.com/MoLow/reporters/commit/d8567bdd2a415919dba6ba652d2e33dc233426ce))

## [1.5.2](https://github.com/MoLow/reporters/compare/github-v1.5.1...github-v1.5.2) (2023-08-13)


### Miscellaneous Chores

* eslint fixes ([3100c40](https://github.com/MoLow/reporters/commit/3100c40ffe3a3e63afb05991f07bf8dbc23efbc9))

## [1.5.1](https://github.com/MoLow/reporters/compare/github-v1.5.0...github-v1.5.1) (2023-07-23)


### Bug Fixes

* add support for esm ([e31f5d5](https://github.com/MoLow/reporters/commit/e31f5d598e44c8e167a33cc3e97571d4402d09dd))

## [1.5.0](https://github.com/MoLow/reporters/compare/github-v1.4.1...github-v1.5.0) (2023-07-20)


### Features

* remove redundant subtests annotation ([6f22533](https://github.com/MoLow/reporters/commit/6f2253378c7ecdcbb5c38aac77dfd13b1662e0d6))


### Bug Fixes

* line reporting for ERR_TEST_FAILURE ([4fb29f3](https://github.com/MoLow/reporters/commit/4fb29f3fb8a470af8d1a9549adc7d91f465cad91))
* stacktrace mislocated ([33068bf](https://github.com/MoLow/reporters/commit/33068bf98f53f7d6d28678b63d58b4c9b04d8ece))


### Documentation

* update screenshots ([0913bf3](https://github.com/MoLow/reporters/commit/0913bf37ce83a0a240c0f28b59a1647741212612))


### Build System

* exclude redundant files ([032eb2f](https://github.com/MoLow/reporters/commit/032eb2fbb1520b3c259e2a80eb38280826e206ef))

## [1.4.1](https://github.com/MoLow/reporters/compare/github-v1.4.0...github-v1.4.1) (2023-07-19)


### Bug Fixes

* more accurate counting ([1949140](https://github.com/MoLow/reporters/commit/19491406b769f03555b3ae352ed9838e2154c855))

## [1.4.0](https://github.com/MoLow/reporters/compare/github-v1.3.0...github-v1.4.0) (2023-07-18)


### Features

* support node 18 ([02c8957](https://github.com/MoLow/reporters/commit/02c8957ffca3cb8376f7ad5a94f4627c70b7f8e5))

## [1.3.0](https://github.com/MoLow/reporters/compare/github-v1.2.0...github-v1.3.0) (2023-07-05)


### Features

* publish with provenance ([6ee1e46](https://github.com/MoLow/reporters/commit/6ee1e46040329edeb0f40f753093b6952984f001))

## [1.2.0](https://github.com/MoLow/reporters/compare/github-v1.1.3...github-v1.2.0) (2023-05-30)


### Features

* report node 20 features ([c99a76c](https://github.com/MoLow/reporters/commit/c99a76c0f6bef75abb2c053c82c88448b0c82690))

## [1.1.3](https://github.com/MoLow/reporters/compare/github-v1.1.2...github-v1.1.3) (2023-04-03)


### Bug Fixes

* allow multiple roots ([590df94](https://github.com/MoLow/reporters/commit/590df948f8a4626fc29e8ce185e08d2226a307ba))

## [1.1.2](https://github.com/MoLow/reporters/compare/github-v1.1.1...github-v1.1.2) (2023-02-28)


### Bug Fixes

* **github:** remove redundant diagnostics ([b62df32](https://github.com/MoLow/reporters/commit/b62df3280b141af763386a68b0b4e386bef907e7))

## [1.1.1](https://github.com/MoLow/reporters/compare/github-v1.1.0...github-v1.1.1) (2023-02-28)


### Bug Fixes

* **github:** silent if not running on github actions ([#33](https://github.com/MoLow/reporters/issues/33)) ([a480454](https://github.com/MoLow/reporters/commit/a480454ac7ca0471744ec00b69a6c67a1d3c8ada))

## [1.1.0](https://github.com/MoLow/reporters/compare/github-v1.0.2...github-v1.1.0) (2023-02-02)


### Features

* use reported file ([#30](https://github.com/MoLow/reporters/issues/30)) ([4c70922](https://github.com/MoLow/reporters/commit/4c709222734de88af71c5a086622c3b022d51fd5))

## [1.0.2](https://github.com/MoLow/reporters/compare/github-v1.0.1...github-v1.0.2) (2022-12-25)


### Bug Fixes

* fix package description ([cec07c7](https://github.com/MoLow/reporters/commit/cec07c70d37b3ed43947b17312a6bd58f095510f))
* some package.json links ([c51a616](https://github.com/MoLow/reporters/commit/c51a61648e29f5baca539ded1b09c2af3f5e0a4a))

## [1.0.1](https://github.com/MoLow/reporters/compare/github-v1.0.0...github-v1.0.1) (2022-12-20)


### Bug Fixes

* fix monorepos release ([8386ef0](https://github.com/MoLow/reporters/commit/8386ef0ea7bfe0c0325e171aa7122eeccb17bad3))
* fix monorepos release ([3c5ee61](https://github.com/MoLow/reporters/commit/3c5ee6126fe961363b3feccf1ba6594a0849855b))
* fix monorepos release ([7eebffb](https://github.com/MoLow/reporters/commit/7eebffb46ab627beaa2b10023a08dd3271f819e9))
* fix monorepos release ([9c66f37](https://github.com/MoLow/reporters/commit/9c66f37b010f782e70c3cdf2bf827d30c4aa71c2))
* fix monorepos release ([d844919](https://github.com/MoLow/reporters/commit/d844919c8684216155b8f1c0acc98d907b3a5cdb))
* fix monorepos release ([d5610e2](https://github.com/MoLow/reporters/commit/d5610e29db730dc4ffa3f9721a85d5f3c7749b2c))
* fix typo ([#22](https://github.com/MoLow/reporters/issues/22)) ([0308fac](https://github.com/MoLow/reporters/commit/0308fac968799a0fd877460deeaa5503bc53d09f))
* reset changelogs ([1e114ce](https://github.com/MoLow/reporters/commit/1e114ced7201cf9897f2cf79b5a4fb46f1b085fb))

## 1.0.0 (2022-12-19)

Initial release
