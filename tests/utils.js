'use strict';

const assert = require('node:assert');
const { hostname } = require('node:os');
const { resolve } = require('node:path');
// eslint-disable-next-line import/no-unresolved
const Snap = require('@matteo.collina/snap');

const nodeMajor = process.versions.node.split('.')[0];

function sanitize(str) {
  return str
    .replaceAll(resolve(process.cwd(), '../../'), 'CWD')
    .replaceAll(process.version, '*')
    .replaceAll(/[0-9.]+ms/g, '*ms')
    .replaceAll(hostname(), 'HOSTNAME')
    .replaceAll(/time="[0-9.]+"/g, 'time="*"')
    .replaceAll(/test_runner\/harness:[0-9.]+\n/g, 'test_runner/harness:*\n')
    .replace(/(?<=\n)(\s+)((.+?)\s+\()?(?:\(?(.+?):(\d+)(?::(\d+))?)\)?(\s+\{)?(\[\d+m)?(\n|$)/g, '$1*$7$8\n');
}

function snapshot(filename) {
  const snap = Snap(filename);
  async function test(child, ...args) {
    const actual = {
      stderr: sanitize(child.stderr?.toString() ?? ''),
      stdout: sanitize(child.stdout?.toString()),
      exitCode: child.status,
    };
    assert.deepStrictEqual(actual, await snap(actual));
    for (const arg of args) {
      const a = typeof arg === 'string' ? sanitize(arg) : arg;
      // eslint-disable-next-line no-await-in-loop
      assert.deepStrictEqual(a, await snap(a));
    }
  }
  test.snap = snap;
  return test;
}

module.exports = {
  Snap: snapshot,
  nodeMajor,
};
