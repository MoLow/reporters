/* eslint-disable class-methods-use-this, no-console */

'use strict';

class Reporter {
  constructor(runner) {
    runner.on('test end', (test) => {
      console.log(`test end: ${test.fullTitle()}`);
    });
    runner.on('suite end', (suite) => {
      if (suite.root) return;
      console.log(`suite end: ${suite.title}`);
    });
  }

  done(failures, fn) {
    fn();
  }
}

module.exports = Reporter;
