const { EOL } = require('node:os');

const WORKSPACE = process.env.GITHUB_WORKSPACE ?? '';

const lines = `
::debug::::starting to run ${WORKSPACE}tests/example.js
::debug::::starting to run tests
::debug::::starting to run is ok
::debug::::completed running is ok
::debug::::starting to run fails
::error:: file=Users/moshe/repos/reporers/tests/example.js,line=6,col=11,title=fails::    at Object.<anonymous> (${WORKSPACE}tests/example.js:6:11)%0A    at ItTest.runInAsyncScope (node:async_hooks:204:9)%0A    ... 5 lines matching cause stack trace ...%0A    at async Suite.run (node:internal/test_runner/test:798:7) {%0A  failureType: 'testCodeFailure',%0A  cause:     at Object.<anonymous> (${WORKSPACE}tests/example.js:6:11)%0A      at ItTest.runInAsyncScope (node:async_hooks:204:9)%0A      at ItTest.run (node:internal/test_runner/test:547:25)%0A      at Suite.processPendingSubtests (node:internal/test_runner/test:302:27)%0A      at ItTest.postRun (node:internal/test_runner/test:632:19)%0A      at ItTest.run (node:internal/test_runner/test:575:10)%0A      at async Promise.all (index 0)%0A      at async Suite.run (node:internal/test_runner/test:798:7) {%0A    code: 'ERR_TEST_FAILURE'%0A  },%0A  code: 'ERR_TEST_FAILURE'%0A}
::error:: title=tests::[Error: 1 subtest failed] { failureType: 'subtestsFailed', cause: [Error: 1 subtest failed] { code: 'ERR_TEST_FAILURE' }, code: 'ERR_TEST_FAILURE' }
::error:: title=${WORKSPACE}tests/example.js::[Error: test failed] { failureType: 'subtestsFailed', cause: 'test failed', code: 'ERR_TEST_FAILURE', exitCode: 1, signal: null }
::group::::Test results (1 passed, 3 failed)
::notice::::tests 1
::notice::::pass 0
::notice::::fail 1
::notice::::cancelled 0
::notice::::skipped 0
::notice::::todo 0
::notice::::duration_ms 99.038125
::endgroup::
`;

lines.split(/\r?\n/).forEach((line) => {
  process.stdout.write(line + EOL);
});
