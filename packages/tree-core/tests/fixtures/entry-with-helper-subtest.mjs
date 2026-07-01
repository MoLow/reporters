// The subtest is defined in subtest-helper.mjs, so its events report that
// file while its parent reports this one.
import { test } from 'node:test';
import { runSubtest } from './subtest-helper.mjs';

test('has subtests in another file', async (t) => {
  await runSubtest(t);
});
