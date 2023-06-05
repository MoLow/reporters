const { describe, test } = require('node:test');
const assert = require('node:assert');

describe('enforce no concurrent tests', { concurrent: false }, () => {
  test('fail', async () => assert.fail());
  test('dont run', async () => {});
});
