import { suite, test } from 'node:test';
import { defineLoggingSubtest } from './log-helper.mjs';

suite('logging suite', (s) => {
  s.log('from the suite');
  test('logging leaf', (t) => {
    t.log('plain');
    t.log('elevated', { level: 'warn', attempt: 2 });
    t.log('structured', { userId: 42 });
  });
});

test('logging parent', async (t) => {
  await defineLoggingSubtest(t);
});
