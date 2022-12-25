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
    const { name } = require(`../packages/${dir.name}/package.json`);
    const args = ['workspace', name, ...cmd];
    console.log(`Running "yarn ${args.join(' ')}" in ${name}`);
    spawnSync('yarn', args, { stdio: 'inherit' });
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
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
