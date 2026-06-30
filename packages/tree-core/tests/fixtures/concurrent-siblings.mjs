import { describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

// Two sibling suites whose children overlap in execution time. Node still emits
// the reporter stream in declaration order with each subtree contiguous, so the
// tree must come out correctly parented even without testId/parentId.
describe('suite A', { concurrency: true }, () => {
  it('a1', async () => { await delay(30); });
  it('a2', async () => { await delay(50); });
});

describe('suite B', { concurrency: true }, () => {
  it('b1', async () => { await delay(10); });
  it('b2', async () => { await delay(40); });
});
