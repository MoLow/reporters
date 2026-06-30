import { describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

// Concurrent subtests so the real runner interleaves start/pass events.
describe('concurrent suite', { concurrency: true }, () => {
  it('slow', async () => { await delay(20); });
  it('fast', async () => { await delay(1); });
  it('medium', async () => { await delay(10); });
});
