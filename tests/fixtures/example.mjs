import { describe, it } from 'node:test';

describe('tests', () => {
  it('is ok', () => {});
  it('fails', () => {
    throw new Error('this is an error');
  });
});
