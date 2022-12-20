const WORKSPACE = process.env.GITHUB_WORKSPACE ?? '';

module.exports = [
  {
    type: 'test:start',
    data: {
      nesting: 0,
      name: `${WORKSPACE}/tests/fixtures/example.js`,
    },
  },
  {
    type: 'test:start',
    data: {
      nesting: 1,
      name: 'tests',
    },
  },
  {
    type: 'test:start',
    data: {
      nesting: 2,
      name: 'is ok',
    },
  },
  {
    type: 'test:pass',
    data: {
      name: 'is ok',
      nesting: 2,
      testNumber: '1',
      details: {
        duration_ms: 0.141459,
      },
    },
  },
  {
    type: 'test:start',
    data: {
      nesting: 2,
      name: 'fails',
    },
  },
  {
    type: 'test:fail',
    data: {
      name: 'fails',
      nesting: 2,
      testNumber: '2',
      details: {
        duration_ms: 0.263875,
        error: {
          failureType: 'testCodeFailure',
          cause: {
            code: 'ERR_TEST_FAILURE',
          },
          code: 'ERR_TEST_FAILURE',
        },
      },
    },
  },
  {
    type: 'test:plan',
    data: {
      nesting: 2,
      count: 2,
    },
  },
  {
    type: 'test:fail',
    data: {
      name: 'tests',
      nesting: 1,
      testNumber: '1',
      details: {
        duration_ms: 3.116167,
        error: {
          failureType: 'subtestsFailed',
          cause: {
            code: 'ERR_TEST_FAILURE',
          },
          code: 'ERR_TEST_FAILURE',
        },
      },
    },
  },
  {
    type: 'test:plan',
    data: {
      nesting: 1,
      count: 1,
    },
  },
  {
    type: 'test:fail',
    data: {
      name: `${WORKSPACE}/tests/fixtures/example.js`,
      nesting: 0,
      testNumber: 1,
      details: {
        duration_ms: 83.583333,
        error: {
          failureType: 'subtestsFailed',
          cause: 'test failed',
          code: 'ERR_TEST_FAILURE',
          exitCode: 1,
          signal: null,
        },
      },
    },
  },
  {
    type: 'test:plan',
    data: {
      nesting: 0,
      count: 1,
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'tests 1',
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'pass 0',
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'fail 1',
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'cancelled 0',
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'skipped 0',
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'todo 0',
    },
  },
  {
    type: 'test:diagnostic',
    data: {
      nesting: 0,
      message: 'duration_ms 84.260333',
    },
  },
];
