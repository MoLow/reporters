'use strict';

const chalk = require('chalk');

module.exports = class WatchSuspendPlugin {
  constructor() {
    this.suspend = false;
  }

  apply(hooks) {
    hooks.shouldRunTestSuite(() => !this.suspend);
    hooks.onTestRunComplete(() => {
      if (this.suspend) {
        console.info(chalk.bold('\nTest is suspended.'));
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  getUsageInfo() {
    return {
      key: 's',
      description: 'suspend watch mode',
    };
  }

  run() {
    this.suspend = !this.suspend;
    if (this.suspend) {
      console.info(chalk.bold('\nTest is suspended.'));
    }
  }
};
