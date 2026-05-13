/* eslint-disable class-methods-use-this, no-console */

'use strict';

class Reporter {
  constructor(runner) {
    runner.on('suite', (suite) => {
      console.log(`suite: ${suite.title}`);
    });
    runner.on('suite end', (suite) => {
      console.log(`suite end: ${suite.title}`);
    });
  }

  done(failures, fn) {
    fn(failures);
  }
}

module.exports = Reporter;
