'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

test('should not run', () => {
  assert.strictEqual(1 + 2, 3);
});
