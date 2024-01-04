'use strict';

const { describe, it } = require('node:test');

describe({ concurrency: 5 }, () => {
  it('is ok', () => {});
  it('is a little slow', (t, done) => setTimeout(done, 300));
  it('is pretty slow', (t, done) => setTimeout(done, 700));
  it('is too slow', (t, done) => setTimeout(done, 1000));
  it('fails', () => {
    throw new Error('this is an error');
  });
});
