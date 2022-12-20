const events = require('./events');
const reporter = require('../index');

// use the reporter manually until --test-reporter is released
process.env.GITHUB_STEP_SUMMARY ??= '/dev/null';
reporter(events);
