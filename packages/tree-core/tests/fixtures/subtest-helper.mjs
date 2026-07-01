export function runSubtest(t) {
  return t.test('subtest', async () => {
    throw new Error('intentional failure from subtest');
  });
}
