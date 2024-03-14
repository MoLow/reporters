/* eslint-disable class-methods-use-this */

'use strict';

class Reporter {
  constructor(runner) {
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
