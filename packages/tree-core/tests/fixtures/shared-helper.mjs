import { test } from 'node:test';

// A test created in a shared module and invoked from multiple test files.
// Every invocation registers a test with the SAME name and the SAME
// file:line:column source location, regardless of which file imported it.
// The only thing that distinguishes the instances is testId (+ the running
// file), which is exactly what the store must key on.
export function makeShared() {
  test('shared passing test', () => {});
  test('shared failing test', () => {
    throw new Error('shared failure');
  });
}
