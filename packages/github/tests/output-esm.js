module.exports = {
  stdout: `::debug::starting to run should fail
::error title=should fail,file=tests/test.mjs,line=5,col=3::\\[Error \\[ERR_TEST_FAILURE\\]: false == true\\] {%0A  failureType: 'testCodeFailure',%0A  cause: AssertionError [ERR_ASSERTION]: false == true%0A      at TestContext.<anonymous> (.*/test.mjs:5:3).* code: 'ERR_TEST_FAILURE'%0A}
::group::Test results (0 passed, 1 failed)
::notice::Total Tests: 1%0ASuites 📂: 0%0APassed ✅: 0%0AFailed ❌: 1%0ACanceled 🚫: 0%0ASkipped ⏭️: 0%0ATodo 📝: 0%0ADuration 🕐: 0.145ms
::endgroup::
`,
  summary: `<h1>Test Results</h1>
<table><tr><td>Total Tests</td><td>1</td></tr><tr><td>Suites 📂</td><td>0</td></tr><tr><td>Passed ✅</td><td>0</td></tr><tr><td>Failed ❌</td><td>1</td></tr><tr><td>Canceled 🚫</td><td>0</td></tr><tr><td>Skipped ⏭️</td><td>0</td></tr><tr><td>Todo 📝</td><td>0</td></tr><tr><td>Duration 🕐</td><td>0.114ms</td></tr></table>
`,
};
