import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('cloud provider', () => {
  describe('AWS', () => {
    describe('RDS', () => {
      it('postgres-encrypted', () => {
        assert.fail('intentional failure');
      });
    });
  });
});
