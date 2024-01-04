'use strict';

module.exports = {
  stdout: `<\\?xml version="1.0" encoding="utf-8"\\?>
<testsuites>
\t<testcase name="should fail" time=".*" classname="test" failure="false == true">
\t\t<failure type="testCodeFailure" message="false == true">
\\[Error \\[ERR_TEST_FAILURE\\]: false == true\\] {
  code: 'ERR_TEST_FAILURE',
  failureType: 'testCodeFailure',
  cause: AssertionError \\[ERR_ASSERTION\\]: false == true
      at TestContext.*/example.mjs:5:3\\)
      at .*
      at .*
      at .*
      at .* {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '=='
  }
}
\t\t</failure>
\t</testcase>
\t<testcase name="should pass" time=".*" classname="test"/>
</testsuites>
`,
  overrides: {
    21: {
      stdout: `<\\?xml version="1.0" encoding="utf-8"\\?>
<testsuites>
\t<testcase name="should fail" time=".*" classname="test" failure="The expression evaluated to a falsy value:  assert\\(false\\)">
\t\t<failure type="testCodeFailure" message="The expression evaluated to a falsy value:  assert\\(false\\)">
\\[Error \\[ERR_TEST_FAILURE\\]: The expression evaluated to a falsy value:

  assert\\(false\\)
] {
  code: 'ERR_TEST_FAILURE',
  failureType: 'testCodeFailure',
  cause: AssertionError \\[ERR_ASSERTION\\]: The expression evaluated to a falsy value:
  
    assert\\(false\\)
  
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
  }
}
\t\t</failure>
\t</testcase>
\t<testcase name="should pass" time=".*" classname="test"/>
</testsuites>
`,
    },
    18: {
      stdout: `<\\?xml version="1.0" encoding="utf-8"\\?>
<testsuites>
\t<testcase name="should fail" time=".*" classname="test" failure="false == true">
\t\t<failure type="testCodeFailure" message="false == true">
\\[Error \\[ERR_TEST_FAILURE\\]: false == true\\] {
  failureType: 'testCodeFailure',
  cause: AssertionError \\[ERR_ASSERTION\\]: false == true
      at TestContext.*/example.mjs:5:3\\)
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
\t\t</failure>
\t</testcase>
\t<testcase name="should pass" time=".*" classname="test"/>
</testsuites>
`,
    },
  },
};
