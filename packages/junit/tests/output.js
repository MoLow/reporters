module.exports = {
  stdout: `<\\?xml version="1.0" encoding="utf-8"\\?>
<testsuites>
\t<testsuite name="tests" time=".*" disabled="0" errors="0" tests="4" failures="2" skipped="0" hostname=".*">
\t\t<testcase name="is ok" time=".*" classname="test"/>
\t\t<testcase name="fails" time=".*" classname="test" failure="this is an error">
\t\t\t<failure type="testCodeFailure" message="this is an error">
\\[Error \\[ERR_TEST_FAILURE\\]: this is an error\\] {
  failureType: 'testCodeFailure',
  cause: Error: this is an error
      .*
      .*
      .*
      .*
      .*
      .*
      .*
      .*
      .*
  code: 'ERR_TEST_FAILURE'
}
\t\t\t</failure>
\t\t</testcase>
\t\t<testcase name="is a diagnostic" time=".*" classname="test"/>
\t\t<testcase name="should fail" time=".*" classname="test" failure="The expression evaluated to a falsy value:

assert\\(false\\)
">
\t\t<failure type="testCodeFailure" message="The expression evaluated to a falsy value:

assert\\(false\\)
">
\\[Error \\[ERR_TEST_FAILURE\\]: The expression evaluated to a falsy value:

assert\\(false\\)
\\] {
failureType: 'testCodeFailure',
cause: AssertionError \\[ERR_ASSERTION\\]: The expression evaluated to a falsy value:

  assert\\(false\\)

    at TestContext.* \\(.*/example.js:10:31\\)
    at .*
    at .*
    at .*
    at .*
    at .*
    at .* {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '=='
},
code: 'ERR_TEST_FAILURE'
}
\t\t\t</failure>
\t\t</testcase>
\t</testsuite>
\t<testsuite name="more tests" time=".*" disabled="0" errors="0" tests="1" failures="0" skipped="0" hostname=".*">
\t\t<testcase name="is ok" time=".*" classname="test"/>
\t</testsuite>
\t<testcase name="is skipped" time=".* classname="test">
\t\t<skipped type="skipped" message="true"/>
\t</testcase>
\t<testcase name="is a todo" time=".*" classname="test">
\t\t<skipped type="todo" message="true"/>
\t</testcase>
</testsuites>
`,
};
