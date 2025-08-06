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
  it('is ok', () => {
    console.log('this is a console log');
  });
});
it.skip('is skipped', () => {});
it.todo('is a todo');

test('top level diagnostic', async (t) => { t.diagnostic('top level diagnostic'); });
