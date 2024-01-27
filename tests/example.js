'use strict';

const { describe, it, test } = require('node:test');
const assert = require('node:assert');

describe('tests', () => {
  it('is ok', () => {});
  it('fails', () => {
    throw new Error('this is an error');
  });
  test('is a diagnostic', async (t) => { t.diagnostic('this is a diagnostic'); });
  test('should fail', () => { assert(false); });
});

describe('more tests', () => {
  it('is ok', () => {});
});
it.skip('is skipped', () => {});
it.todo('is a todo');
