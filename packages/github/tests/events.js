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
        duration_ms: 0.139292,
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
        duration_ms: 0.275709,
        error: Object.assign(new Error(''), {
          failureType: 'testCodeFailure',
          cause: {
            code: 'ERR_TEST_FAILURE',
          },
          code: 'ERR_TEST_FAILURE',
          stack: `    at Object.<anonymous> (${WORKSPACE}/tests/fixtures/example.js:6:11)\n    at ItTest.runInAsyncScope (node:async_hooks:204:9)\n    ... 5 lines matching cause stack trace ...\n    at async Suite.run (node:internal/test_runner/test:798:7) {\n  failureType: 'testCodeFailure',\n  cause:     at Object.<anonymous> (${WORKSPACE}/tests/fixtures/example.js:6:11)\n      at ItTest.runInAsyncScope (node:async_hooks:204:9)\n      at ItTest.run (node:internal/test_runner/test:547:25)\n      at Suite.processPendingSubtests (node:internal/test_runner/test:302:27)\n      at ItTest.postRun (node:internal/test_runner/test:632:19)\n      at ItTest.run (node:internal/test_runner/test:575:10)\n      at async Promise.all (index 0)\n      at async Suite.run (node:internal/test_runner/test:798:7)`,
        }),
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
        duration_ms: 2.925542,
        error: Object.assign(new Error('1 subtest failed'), {
          failureType: 'subtestsFailed',
          cause: {
            code: 'ERR_TEST_FAILURE',
          },
          code: 'ERR_TEST_FAILURE',
          stack: '',
        }),
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
        duration_ms: 86.369584,
        error: Object.assign(new Error('test failed'), {
          failureType: 'subtestsFailed',
          cause: 'test failed',
          code: 'ERR_TEST_FAILURE',
          exitCode: 1,
          signal: null,
          stack: '',
        }),
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
      message: 'duration_ms 87.068833',
    },
  },
];
