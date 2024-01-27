'use strict';

module.exports = {
  stdout: `::debug::starting to run tests
::debug::starting to run is ok
::debug::completed running is ok
::debug::starting to run fails
::error title=fails,file=tests/example.js,line=9,col=11::\\[Error \\[ERR_TEST_FAILURE\\]: this is an error\\] {%0A  code: 'ERR_TEST_FAILURE',%0A  failureType: 'testCodeFailure',%0A  cause: Error: this is an error%0A      at TestContext.<anonymous> (.*/example.js:9:11).*%0A}
::debug::starting to run is a diagnostic
::debug::completed running is a diagnostic
::notice file=tests/example.js::this is a diagnostic
::debug::starting to run should fail
::error title=should fail,file=tests/example.js,line=12,col=31::\\[Error \\[ERR_TEST_FAILURE\\]: The expression evaluated to a falsy value:%0A%0A  assert\\(false\\)%0A\\] {%0A  code: 'ERR_TEST_FAILURE',%0A  failureType: 'testCodeFailure',%0A  cause: AssertionError \\[ERR_ASSERTION\\]: The expression evaluated to a falsy value:%0A  %0A    assert\\(false\\)%0A  %0A      at TestContext.<anonymous> (.*/example.js:12:31).*
::debug::starting to run more tests
::debug::starting to run is ok
::debug::completed running is ok
::debug::completed running more tests
::debug::starting to run is skipped
::debug::completed running is skipped
::debug::starting to run is a todo
::debug::completed running is a todo
::group::Test results \\(3 passed, 2 failed\\)
::notice::Total Tests: 7%0ASuites 📂: 2%0APassed ✅: 3%0AFailed ❌: 2%0ACanceled 🚫: 0%0ASkipped ⏭️: 1%0ATodo 📝: 1%0ADuration 🕐: .*ms
::endgroup::
`,
  summary: `<h1>Test Results</h1>
<table><tr><td>Total Tests</td><td>7</td></tr><tr><td>Suites 📂</td><td>2</td></tr><tr><td>Passed ✅</td><td>3</td></tr><tr><td>Failed ❌</td><td>2</td></tr><tr><td>Canceled 🚫</td><td>0</td></tr><tr><td>Skipped ⏭️</td><td>1</td></tr><tr><td>Todo 📝</td><td>1</td></tr><tr><td>Duration 🕐</td><td>.*ms</td></tr></table>
`,
  overrides: {
    18: {
      stdout: `::debug::starting to run tests
::debug::starting to run is ok
::debug::completed running is ok
::debug::starting to run fails
::error title=fails,file=tests/example.js,line=9,col=11::\\[Error \\[ERR_TEST_FAILURE\\]: this is an error\\] {%0A  failureType: 'testCodeFailure',%0A  cause: Error: this is an error%0A      at TestContext.<anonymous> (.*/example.js:9:11).* code: 'ERR_TEST_FAILURE'%0A}
::debug::starting to run is a diagnostic
::debug::completed running is a diagnostic
::notice file=tests/example.js::this is a diagnostic
::debug::starting to run should fail
::error title=should fail,file=tests/example.js,line=12,col=31::\\[Error \\[ERR_TEST_FAILURE\\]: The expression evaluated to a falsy value:%0A%0A  assert\\(false\\)%0A\\] {%0A  failureType: 'testCodeFailure',%0A  cause: AssertionError \\[ERR_ASSERTION\\]: The expression evaluated to a falsy value:%0A  %0A    assert\\(false\\)%0A  %0A      at TestContext.<anonymous> (.*/example.js:12:31).*
::debug::starting to run more tests
::debug::starting to run is ok
::debug::completed running is ok
::debug::completed running more tests
::debug::starting to run is skipped
::debug::completed running is skipped
::debug::starting to run is a todo
::debug::completed running is a todo
::group::Test results \\(3 passed, 2 failed\\)
::notice::Total Tests: 7%0ASuites 📂: 2%0APassed ✅: 3%0AFailed ❌: 2%0ACanceled 🚫: 0%0ASkipped ⏭️: 1%0ATodo 📝: 1%0ADuration 🕐: .*ms
::endgroup::
`,
    },
  },
};
