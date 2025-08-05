'use strict';

const assert = require('node:assert');
const { hostname } = require('node:os');
const { resolve } = require('node:path');
// eslint-disable-next-line import/no-unresolved
const { format: prettyFormat } = require('pretty-format');

const nodeMajor = process.versions.node.split('.')[0];

function sanitize(str) {
  return str
    .replaceAll(resolve(process.cwd(), '../../'), 'CWD')
    .replaceAll(process.version, '*')
    .replaceAll(/[0-9.]+ms/g, '*ms')
    .replaceAll(hostname(), 'HOSTNAME')
    .replaceAll(/time="[0-9.]+"/g, 'time="*"')
    .replaceAll(/test_runner\/harness:[0-9.]+\n/g, 'test_runner/harness:*\n')
    // eslint-disable-next-line no-control-regex
    .replaceAll(/\u001b\[[0-9;]*m/g, '')
    .replace(/(?<=\n)(\s+)((.+?)\s+\()?(?:\(?(.+?):(\d+)(?::(\d+))?)\)?(\s+\{)?(\[\d+m)?(\n|$)/g, '$1*$7$8\n');
}

function snapshot(filename) {
  // eslint-disable-next-line no-underscore-dangle
  let snap_;
  async function snap(actual) {
    // eslint-disable-next-line import/extensions
    snap_ ??= (await import('./snap.mjs')).default(filename);
    return snap_(actual);
  }
  async function test(child, ...args) {
    const actual = prettyFormat({
      stderr: sanitize(child.stderr?.toString() ?? ''),
      stdout: sanitize(child.stdout?.toString() ?? ''),
      exitCode: child.status,
    });
    const expected = await snap(actual);
    assert.deepStrictEqual(actual, expected);
    for (const arg of args) {
      const a = typeof arg === 'string' ? sanitize(arg) : arg;
      // eslint-disable-next-line no-await-in-loop
      assert.deepStrictEqual(a, await snap(a));
    }
  }
  test.snap = snap;
  test.snap.serialize = prettyFormat;
  return test;
}

module.exports = {
  Snap: snapshot,
  nodeMajor,
};
