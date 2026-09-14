import { test } from 'node:test';

test('parent that fails after its subtest passed', async (t) => {
  await t.test('inner check', () => {});
  throw new Error('assertion after subtests');
});
