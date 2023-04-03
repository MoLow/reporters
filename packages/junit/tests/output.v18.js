module.exports = {
  stdout: `<\\?xml version="1.0" encoding="utf-8"\\?>
<testsuites>
\t<testsuite name="tests" time=".*" disabled="0" errors="0" tests="3" failures="1" skipped="0" hostname=".*">
\t\t<testcase name="is ok" time=".*" classname="test"/>
\t\t<testcase name="fails" time=".*" classname="test" failure="this is an error">
\t\t\t<failure type="testCodeFailure" message="this is an error">
\\[Error \\[ERR_TEST_FAILURE\\]: this is an error\\] {
  failureType: 'testCodeFailure',
  cause: Error: this is an error
      at Object.&lt;anonymous&gt; (.*)
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
\t</testsuite>
\t<testsuite name="more tests" time=".*" disabled="0" errors="0" tests="1" failures="0" skipped="0" hostname=".*">
\t\t<testcase name="is ok" time=".*" classname="test"/>
\t</testsuite>
</testsuites>
`,
};
