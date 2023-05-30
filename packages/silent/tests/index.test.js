const { spawnSync } = require('child_process');
const assert = require('assert');

const child = spawnSync(process.execPath, ['--test-reporter', './index.js', '../../tests/example'], { env: {} });

assert.strictEqual(child.stderr?.toString(), '');
assert.strictEqual(child.stdout?.toString(), '');
