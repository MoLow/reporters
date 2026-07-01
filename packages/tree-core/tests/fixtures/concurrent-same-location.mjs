// Multiple concurrent `it` tests call a shared factory that creates a subtest
// at the same source location via `t.test('e2e', ...)`. With concurrency
// enabled, an early test:complete must land on the correct instance — a
// passing test's instance must not consume a failing test's early complete.
import { describe, it } from 'node:test';

function makeSubtest(shouldFail) {
  return async function (t) {
    await t.test('e2e', async () => {
      if (shouldFail) throw new Error('intentional');
    });
  };
}

describe('S3', { concurrency: 10_000 }, () => {
  it('test-A (passes)', makeSubtest(false));
  it('test-B (passes)', makeSubtest(false));
  it('test-C (fails)', makeSubtest(true));
  it('test-D (passes)', makeSubtest(false));
});
