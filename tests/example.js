const { describe, it, test } = require('node:test');

describe('tests', () => {
  it('is ok', () => {});
  it('fails', () => {
    throw new Error('this is an error');
  });
});
