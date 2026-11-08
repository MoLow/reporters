'use strict';

// Keep the printed stack free of node:test internals that vary between Node versions.
Error.stackTraceLimit = 1;

const { after, describe, test } = require('node:test');

describe('suite with a failing hook', () => {
  after(() => { throw new Error('the reason this hook failed'); });
  test('pass', () => {});
});
