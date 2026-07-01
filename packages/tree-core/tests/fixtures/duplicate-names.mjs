import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('suite-1', () => {
  it('connectivity', () => {
    assert.fail('intentional failure');
  });
});

describe('suite-2', () => {
  it('connectivity', () => {
    assert.fail('intentional failure');
  });
});
