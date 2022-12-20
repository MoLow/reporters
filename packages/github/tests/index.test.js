const events = require('./events');
const reporter = require('../index');

// use the reporter manually until --test-reporter is released
reporter(events);
