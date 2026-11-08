'use strict';

// Keep the printed stack free of node:test internals that vary between Node versions.
Error.stackTraceLimit = 1;

const { describe, test } = require('node:test');

describe('enforce no concurrent tests', { concurrent: false }, () => {
  test('fail', async () => { throw new Error('the reason this test failed'); });
  test('dont run', async () => {});
});
