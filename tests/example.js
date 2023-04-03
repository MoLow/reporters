const { describe, it, test } = require('node:test');

describe('tests', () => {
  it('is ok', () => {});
  it('fails', () => {
    throw new Error('this is an error');
  });
  test('is a diagnostic', async (t) => { t.diagnostic('this is a diagnostic'); });
});

describe('more tests', () => {
  it('is ok', () => {});
});
