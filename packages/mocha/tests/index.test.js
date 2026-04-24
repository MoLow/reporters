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

function collectOutput(child) {
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return {
    stdout() {
      return stdout;
    },
    stderr() {
      return stderr;
    },
  };
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
  const child = spawnSync(process.execPath, ['--test', '--test-reporter', '../../index.js', './*.not-real.js'], { env: {}, cwd: resolve('./tests/emptySuiteReporter') });
  await snapshot(child);
});

test('streams built-in reporter output before suite end', async () => {
  const child = spawn(process.execPath, ['--test-reporter', './index.js', '../../tests/slow_tests.js'], { env: {} });
  const output = collectOutput(child);

  const partialStdout = await waitForStdoutMatch(child, /is a little slow/);
  assert.strictEqual(child.exitCode, null);

  const [code] = await once(child, 'close');
  await snapshot({
    status: code,
    stdout: output.stdout(),
    stderr: output.stderr(),
  }, partialStdout);
});

test('streams custom reporter callbacks before suite completion', async () => {
  const child = spawn(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/slow_tests.js'], { env: {},  cwd: resolve('./tests/progressiveReporter') });
  const output = collectOutput(child);

  const partialStdout = await waitForStdoutMatch(child, /test end:/);
  assert.strictEqual(child.exitCode, null);

  const [code] = await once(child, 'close');
  await snapshot({
    status: code,
    stdout: output.stdout(),
    stderr: output.stderr(),
  }, partialStdout);
});

test('preserves incoming completion order for concurrent children', async () => {
  const child = spawnSync(process.execPath, ['--test-reporter', '../../index.js', '../../../../tests/slow_tests.js'], {
    cwd: resolve('./tests/customReporter'),
    env: {},
  });
  await snapshot(child);
});
