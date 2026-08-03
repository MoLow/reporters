export function defineLoggingSubtest(t) {
  return t.test('helper-defined subtest', (sub) => {
    sub.log('from a helper file');
  });
}
