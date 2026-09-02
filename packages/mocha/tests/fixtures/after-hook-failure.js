import { after, describe, it } from 'node:test';

describe('suite with a failing after hook', () => {
  after(() => {
    throw new Error('after hook failed');
  });

  it('passes its test', () => {});
});
