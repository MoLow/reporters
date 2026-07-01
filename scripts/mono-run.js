'use strict';

/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const { opendir } = require('node:fs/promises');

const cmd = process.argv.slice(2);

function runCommand(dir) {
  if (!dir.isDirectory()) {
    return;
  }
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const { name, scripts } = require(`../packages/${dir.name}/package.json`);
    // Skip packages that don't define the requested script (e.g. `build` only
    // exists in the TypeScript packages), so `yarn mono build` just works.
    if (!scripts || !scripts[cmd[0]]) {
      return;
    }
    const args = ['workspace', name, ...cmd];
    console.log(`Running "yarn ${args.join(' ')}" in ${name}`);
    // Don't forward a TTY stdin: it would make interactive reporters (e.g.
    // @reporters/live) hold the terminal open waiting for keystrokes.
    const child = spawnSync('yarn', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    if (child.status !== 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(err);
  }
}

(async function main() {
  const packages = await opendir('./packages/');
  for await (const dir of packages) {
    runCommand(dir);
  }
}())
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
