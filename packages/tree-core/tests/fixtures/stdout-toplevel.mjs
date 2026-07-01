import { test } from 'node:test';

console.log('top-level stdout');
console.error('top-level stderr');

test('a passing test', () => {});
