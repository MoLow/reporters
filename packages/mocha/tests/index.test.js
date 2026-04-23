'use strict';

const { test } = require('node:test');
const { once } = require('node:events');
const { resolve } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('assert');
const { Snap, nodeMajor } = require('../../../tests/utils');
const reporter = require('../index');

const snapshot = Snap(`${__filename}.${nodeMajor}`);

function waitForStdoutMatch(child, matcher, timeoutMs = 2000) {
  let stdout = '';

  return new Promise((resolvePromise, reject) => {
    let timeout;
    let onData;
    let onClose;

    function cleanup() {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.off('close', onClose);
    }

    onData = (chunk) => {
      stdout += chunk.toString();
      if (!matcher.test(stdout)) return;
      cleanup();
      resolvePromise(stdout);
    };

    onClose = (code, signal) => {
      cleanup();
      reject(new Error(`process closed before matching output (${code ?? signal})\n${stdout}`));
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error(`timed out waiting for stdout\n${stdout}`));
    };

    timeout = setTimeout(onTimeout, timeoutMs);
    child.stdout.on('data', onData);
    child.on('close', onClose);
  });
}

test('spawn with reporter', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });
  await snapshot(child);
});

test('spawn with reporter - esm', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example.mjs'], { env: {} });
  await snapshot(child);
});

test('custom reporter - file', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/example.js'], { env: {}, cwd: resolve('./tests/customReporter') });
  await snapshot(child);
});

test('custom reporter - function', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/example.js'], { env: {}, cwd: resolve('./tests/importReporter') });
  await snapshot(child);
});

test('reporter not found', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/example.js'], { env: {}, cwd: resolve('./tests/invalidReporter') });
  await snapshot(child);
});

test('empty', async () => {
  await assert.doesNotReject(reporter([]));
});

test('single test', async () => {
  await assert.doesNotReject(reporter([{ type: 'test:pass', data: { name: 'test', nesting: 0, details: { duration_ms: 100 } } }]));
});

test('emits root suite lifecycle for empty sources', async () => {
  /* eslint-disable no-console */
  const cwd = process.cwd();
  const logs = [];
  const originalLog = console.log;
  console.log = (value) => logs.push(value);
  process.chdir(resolve('./tests/emptySuiteReporter'));

  try {
    await reporter([]);
  } finally {
    console.log = originalLog;
    process.chdir(cwd);
  }

  assert.deepStrictEqual(logs, [
    'suite: ',
    'suite end: ',
  ]);
  /* eslint-enable no-console */
});

test('streams built-in reporter output before suite end', async () => {
  const child = spawn(process.execPath, ['--test-reporter', './index.js', '../../tests/slow_tests.js'], {
    cwd: process.cwd(),
    env: {},
  });

  const partialStdout = await waitForStdoutMatch(child, /is a little slow/);
  assert.strictEqual(child.exitCode, null);
  assert.match(partialStdout, /is ok/);
  assert.doesNotMatch(partialStdout, /4 passing/);

  const [code] = await once(child, 'close');
  assert.strictEqual(code, 1);
});

test('streams custom reporter callbacks before suite completion', async () => {
  const child = spawn(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/slow_tests.js'], {
    cwd: resolve('./tests/progressiveReporter'),
    env: {},
  });

  const partialStdout = await waitForStdoutMatch(child, /test end:/);
  assert.strictEqual(child.exitCode, null);
  assert.doesNotMatch(partialStdout, /suite end: <anonymous>/);

  const [code] = await once(child, 'close');
  assert.strictEqual(code, 1);
});

test('preserves incoming completion order for concurrent children', async () => {
  /* eslint-disable no-console */
  const cwd = process.cwd();
  const logs = [];
  const source = [
    { type: 'test:start', data: { name: 'concurrent suite', nesting: 0, file: 'suite.js' } },
    { type: 'test:start', data: { name: 'fast second', nesting: 1, file: 'suite.js' } },
    {
      type: 'test:pass',
      data: {
        name: 'fast second',
        nesting: 1,
        file: 'suite.js',
        details: { duration_ms: 50, type: 'test' },
      },
    },
    { type: 'test:start', data: { name: 'slow first', nesting: 1, file: 'suite.js' } },
    {
      type: 'test:pass',
      data: {
        name: 'slow first',
        nesting: 1,
        file: 'suite.js',
        details: { duration_ms: 400, type: 'test' },
      },
    },
    {
      type: 'test:pass',
      data: {
        name: 'concurrent suite',
        nesting: 0,
        file: 'suite.js',
        details: { duration_ms: 450, type: 'suite' },
      },
    },
  ];

  process.chdir(resolve('./tests/customReporter'));
  const originalLog = console.log;
  console.log = (value) => logs.push(value);

  try {
    await reporter(source);
  } finally {
    console.log = originalLog;
    process.chdir(cwd);
  }

  assert.deepStrictEqual(logs.map((log) => log.fullTitle), [
    ' concurrent suite fast second',
    ' concurrent suite slow first',
  ]);
  /* eslint-enable no-console */
});
