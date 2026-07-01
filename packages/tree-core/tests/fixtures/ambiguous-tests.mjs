import { describe, it } from 'node:test';
import assert from 'node:assert';

// Tests generated in a loop share the same source location (line:column).
function createTests(label) {
  describe(label, () => {
    it('check connectivity', () => {
      assert.fail('intentional failure');
    });
  });
}

createTests('region-1');
createTests('region-2');
