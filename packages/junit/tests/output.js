module.exports = {
  stdout: `<\\?xml version="1.0" encoding="utf-8"\\?>
<testsuites>
  <testsuite name="tests" time=".*" disabled="0" errors="0" tests="2" failures="1" skipped="0" hostname=".*">
    <testcase name="is ok" time=".*" classname="test"></testcase>
    <testcase name="fails" time=".*" classname="test" failure="this is an error">
      <failure message="this is an error" type="testCodeFailure">
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
      .*
  code: 'ERR_TEST_FAILURE'
}
      </failure>
    </testcase>
  </testsuite>
</testsuites>
`,
};
