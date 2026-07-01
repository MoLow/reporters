// A parent test hits its timeout while its subtests hang; node:test then
// emits test:complete for the cancelled subtests twice — once at cancellation
// time and once during parent teardown.
import { describe, it } from 'node:test';

function hangForever() {
  return new Promise(() => {
    // Unref'd timer keeps the Promise pending without blocking process exit
    // once the test runner cancels the subtest.
    setTimeout(() => {}, 2_147_483_647).unref();
  });
}

describe('OUTER', () => {
  it('should cancel by timeout', { timeout: 500 }, async (t) => {
    await t.test('middle', async (middle) => {
      await Promise.all([
        middle.test('restore object', hangForever),
        middle.test('restore bucket', hangForever),
      ]);
    });
  });
});
