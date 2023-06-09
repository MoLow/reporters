const { describe, it } = require('node:test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout } = require('node:timers/promises');
const assert = require('node:assert');
const path = require('node:path');
const { isSupported } = require('../nodeVersion');

const clear = '\x1Bc';
const esc = '\x1b';
const clearLines = '\x1B[1A\x1B[2K\x1B[1A\x1B[2K';
const testsRun = [
  `✔ j - sum (*ms)
✔ j - subtraction (*ms)`,
  `✔ index - sum (*ms)
✔ index - subtraction (*ms)`,
];
const tests = `${testsRun[0]}\n${testsRun[1]}`;
const mainMenu = `
REPL Usage
 › Press a to run all tests.
 › Press p to filter by a file name pattern.
 › Press t to filter by a test name pattern.
 › Press q to quit.
 › Press Enter to trigger a test run.
`;
const mainMenuWithFilters = mainMenu.replace('REPL Usage', `REPL Usage
 › Press c to clear the filters.`);
const compactMenu = '\nREPL Usage: Press w to show more.';
const filterTestsPrompt = `
Filter Test
 › Press Enter to filter by a test name pattern.
 › Press Esc to exit pattern mode.

 pattern › `;
const filterFilesPrompt = filterTestsPrompt.replace('test', 'file').replace('Test', 'File');

async function spawnInteractive(commandSequence = 'q') {
  let stderr = '';
  let stdout = '';
  const child = spawn(process.execPath, ['../../index.js'], {
    env: { }, cwd: path.resolve(__dirname, 'fixtures'),
  });
  child.stdin.setEncoding('utf8');
  let writing = false;
  async function writeInput() {
    if (writing) return;
    writing = true;
    for (const char of commandSequence) {
      child.stdin.cork();
      child.stdin.write(`${char}`);
      child.stdin.uncork();
      if (char === 'a' || char === 'c' || char === '\r' || char === esc) {
        // wait for tests to run before writing the next command
        // eslint-disable-next-line no-await-in-loop
        await setTimeout(1100);
      }
    }
  }
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => { stderr += data; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => {
    stdout += data;
    if (stdout.includes(mainMenu)) {
      writeInput();
    }
  });

  return new Promise((resolve, reject) => {
    child.on('close', async (code, signal) => {
      const outputs = stdout.replace(/\(.*ms\)/g, '(*ms)').split(clear);
      resolve({
        code, signal, stderr, outputs,
      });
    });
    child.on('error', (code, signal) => {
      /* c8 ignore next 5 */
      const outputs = stdout.replace(/\(.*ms\)/g, '(*ms)').split(clear);
      // eslint-disable-next-line prefer-promise-reject-errors
      reject({
        code, signal, stderr, outputs,
      });
    });
  });
}

describe('testwatch', { concurrency: true, skip: !isSupported ? 'unsupported node version' : false }, () => {
  it('should run all tests on initialization', async () => {
    const { outputs, stderr } = await spawnInteractive('q');
    assert.strictEqual(stderr, '');
    assert.deepStrictEqual(outputs, ['', `${tests}\n${mainMenu}\n`]);
  });
  it('should handle CTR + C', async () => {
    const { outputs, stderr } = await spawnInteractive('\x03');
    assert.strictEqual(stderr, '');
    assert.deepStrictEqual(outputs, ['', `${tests}\n${mainMenu}\n`]);
  });
  it('should handle CTR + D', async () => {
    const { outputs, stderr } = await spawnInteractive('\x04');
    assert.strictEqual(stderr, '');
    assert.deepStrictEqual(outputs, ['', `${tests}\n${mainMenu}\n`]);
  });
  it('should exit on sigkill', async () => {
    const child = spawn(process.execPath, ['../../index.js'], {
      env: { }, cwd: path.resolve(__dirname, 'fixtures'),
    });
    let stderr = '';
    let stdout = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data) => { stderr += data; });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => { stdout += data; });
    child.kill('SIGKILL');
    const [code, signal] = await once(child, 'close');
    assert.strictEqual(stderr, '');
    assert.strictEqual(stdout, '');
    assert.strictEqual(signal, 'SIGKILL');
    assert.strictEqual(code, null);
  });
  it('should run all tests on "a"', async () => {
    const { outputs, stderr } = await spawnInteractive('aq');
    assert.strictEqual(stderr, '');
    assert.deepStrictEqual(outputs, ['', `${tests}\n${mainMenu}`, `${tests}\n${compactMenu}\n`]);
  });
  it('should run all tests on Enter', async () => {
    const { outputs, stderr } = await spawnInteractive('\rq');
    assert.strictEqual(stderr, '');
    assert.deepStrictEqual(outputs, ['', `${tests}\n${mainMenu}`, `${tests}\n${compactMenu}\n`]);
  });
  it('should show full menu on "w" after running tests', async () => {
    const { outputs, stderr } = await spawnInteractive('awq');
    assert.strictEqual(stderr, '');
    assert.deepStrictEqual(outputs, [
      '',
      `${tests}\n${mainMenu}`,
      `${tests}\n${compactMenu}\n${clearLines}${mainMenu}\n`,
    ]);
  });

  describe('filters', () => {
    it('should filter tests on "t"', async () => {
      const { outputs, stderr } = await spawnInteractive(['t', 'sub', '\r', 'w', 'q'].join(''));
      const activeFilters = '\nActive Filters: test name /sub/\n';
      assert.strictEqual(stderr, '');
      assert.deepStrictEqual(outputs, [
        '',
        `${tests}\n${mainMenu}`,
        `${filterTestsPrompt}sub`,
        '',
        `${tests
          .replace('✔ j - sum (*ms)', '﹣ j - sum (*ms) # SKIP')
          .replace('✔ index - sum (*ms)', '﹣ index - sum (*ms) # SKIP')
        }\n${compactMenu}\n${clearLines}${activeFilters}${mainMenuWithFilters}\n`,
      ]);
    });

    describe('files filter', () => {
      it('should filter files on "p"', async () => {
        const { outputs, stderr } = await spawnInteractive(['p', 'index', '\r', 'w', 'q'].join(''));
        const activeFilters = '\nActive Filters: file name **/index*.*\n';
        assert.strictEqual(stderr, '');
        assert.deepStrictEqual(outputs, [
          '',
          `${tests}\n${mainMenu}`,
          `${filterFilesPrompt}index`,
          '',
          `${testsRun[1]}\n${compactMenu}\n${clearLines}${activeFilters}${mainMenuWithFilters}\n`,
        ]);
      });

      it('should filter partial file names on "p"', async () => {
        const { outputs, stderr } = await spawnInteractive(['p', 'ind', '\r', 'w', 'q'].join(''));
        const activeFilters = '\nActive Filters: file name **/ind*.*\n';
        assert.strictEqual(stderr, '');
        assert.deepStrictEqual(outputs, [
          '',
          `${tests}\n${mainMenu}`,
          `${filterFilesPrompt}ind`,
          '',
          `${testsRun[1]}\n${compactMenu}\n${clearLines}${activeFilters}${mainMenuWithFilters}\n`,
        ]);
      });
    });
    it('should filter tests and files togetheer', async () => {
      const { outputs, stderr } = await spawnInteractive(['p', 'index', '\r', 't', 'sum', '\r', 'w', 'q'].join(''));
      const activeFilters = '\nActive Filters: file name **/index*.*, test name /sum/\n';
      assert.strictEqual(stderr, '');
      assert.strictEqual(outputs.length, 8);
      assert.strictEqual(outputs[7], `${testsRun[1].replace('✔ index - subtraction (*ms)', '﹣ index - subtraction (*ms) # SKIP')}\n${compactMenu}\n${clearLines}${activeFilters}${mainMenuWithFilters}\n`);
    });

    it('should mention when no files found', async () => {
      const { outputs, stderr } = await spawnInteractive(['p', 'nothing', '\r', 'w', 'q'].join(''));
      const activeFilters = '\nActive Filters: file name **/nothing*.*\n';
      const notFound = '\nNo files found for pattern **/nothing*.*';
      assert.strictEqual(stderr, '');
      assert.deepStrictEqual(outputs, [
        '',
        `${tests}\n${mainMenu}`,
        `${filterFilesPrompt}nothing`,
        '',
        `${notFound}\n${compactMenu}\n${clearLines}${activeFilters}${mainMenuWithFilters}\n`,
      ]);
    });

    it('should clear filters on "c"', async () => {
      const { outputs, stderr } = await spawnInteractive(['p', 'index', '\r', 'w', 't', 'sum', '\r', 'w', 'c', 'w', 'q'].join(''));
      assert.strictEqual(stderr, '');
      assert.strictEqual(outputs.length, 9);

      assert.match(outputs[4], /Active Filters: file name \*\*\/index\*\.\*/);
      assert.match(outputs[5], /Active Filters: file name \*\*\/index\*\.\*/);
      assert.match(outputs[7], /Active Filters: file name \*\*\/index\*\.\*, test name \/sum\//);
      assert.strictEqual(outputs[8], `${tests}\n${compactMenu}\n${clearLines}${mainMenu}\n`);
    });

    it('prompt ESC should preserve previous state', async () => {
      const { outputs } = await spawnInteractive(['p', esc, 'p', 'filter', '\r', 'p', esc, 'q'].join(''));
      const notFound = '\nNo files found for pattern **/filter*.*';
      const activeFilters = '\nActive Filters: file name **/filter*.*\n';
      assert.deepStrictEqual(outputs, [
        '',
        `${tests}\n${mainMenu}`,
        `${filterFilesPrompt}`,
        '',
        `${tests}\n${compactMenu}`,
        `${filterFilesPrompt}filter`,
        '',
        `${notFound}\n${compactMenu}`,
        `${activeFilters}${filterFilesPrompt}`,
        '',
        `${notFound}\n${compactMenu}\n`,
      ]);
    });

    it('backspace shoud remove last character', async () => {
      const backspace = '\x7f';
      const { outputs, stderr } = await spawnInteractive(['p', `noth123${backspace}${backspace}ing`, '\r', 'w', 'q'].join(''));
      assert.strictEqual(stderr, '');
      assert.strictEqual(outputs.length, 5);
      assert.match(outputs[4], /No files found for pattern \*\*\/noth1ing\*\.\*/);
    });
  });
});
