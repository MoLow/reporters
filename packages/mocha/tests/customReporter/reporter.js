/* eslint-disable class-methods-use-this */

'use strict';

const assert = require('assert');

class Reporter {
  constructor(runner) {
    assert(runner.suite, 'missing root suite');
    runner.on('test end', (test) => {
      console.log({
        state: test.state,
        isPending: test.isPending(),
        currentRetry: test.currentRetry(),
        fullTitle: test.fullTitle(),
      });
    });
  }

  done(failures, fn) {
    fn();
  }
}

module.exports = Reporter;
