#!/usr/bin/env node

'use strict';

const { run } = require('node:test');
const { pipeline } = require('node:stream/promises');
const {
  on, once, EventEmitter, setMaxListeners,
} = require('node:events');
const { glob } = require('glob');
const chalk = require('chalk');
const { isSupported } = require('./nodeVersion');

if (!isSupported) {
  /* c8 ignore next 3 */
  console.log(chalk.magenta('Node.js <= 20.3.0 is not supported.'));
  process.exit(0);
}
// eslint-disable-next-line import/no-unresolved, import/order
const { spec: SpecReporter } = require('node:test/reporters');
const WatchSuspendPlugin = require('./tests/fixtures/suspend-plugin');

const KEYS = {
  CTRLC: '\x03',
  CTRLD: '\x04',
  BACKSPACE: '\x7f',
  ESC: '\x1b',
  ENTER: '\r',
};
const KEY_NAMES = {
  [KEYS.ENTER]: 'Enter',
  [KEYS.ESC]: 'Esc',
};
const UnknownCommand = Symbol('UnknownKey');

setMaxListeners(Infinity);
process.stdout.setMaxListeners(Infinity);
process.setMaxListeners(Infinity);
process.stdin.setEncoding('utf8');
process.stdin.setRawMode?.(true);

class REPL {
  #controller = new AbortController();

  #hooks = {
    shouldRunTestSuite: [],
    onTestRunComplete: [],
  };

  #filesFilter = process.argv[2] || '';

  #testsFilter = '';

  #mainCommands = Object.freeze({
    c: { fn: () => this.#clearFilter(), description: 'clear the filters.', active: () => this.#filesFilter || this.#testsFilter },
    a: { fn: () => this.#runTests(), description: 'run all tests.' },
    p: { fn: () => this.#filterFile(), description: 'filter by a file name pattern.' },
    t: { fn: () => this.#filterTest(), description: 'filter by a test name pattern.' },
    q: { fn: () => this.#quit(), description: 'quit.' },
    [KEYS.ENTER]: { fn: () => this.#runTests(), description: 'trigger a test run.' },
  });

  #currentCommands = this.#mainCommands;

  #emitter = new EventEmitter();

  async #runTests() {
    this.#clear();
    this.#controller.abort();
    this.#controller = new AbortController();
    if (this.#hooks.shouldRunTestSuite.some((fn) => !fn())) {
      this.#clear();
      this.#emitter.emit('drained');
      this.#hooks.onTestRunComplete.forEach((fn) => fn());
      return;
    }

    const filter = this.#filesFilter ? `**/${this.#filesFilter}*.*` : '**/?(*.)+(spec|test).[jt]s';
    const files = await glob(filter, { ignore: 'node_modules/**' });

    if (!files.length) {
      process.stdout.write(chalk.red(`\nNo files found for pattern ${filter}\n`));
      this.#emitter.emit('drained');
      this.#hooks.onTestRunComplete.forEach((fn) => fn());
      return;
    }

    let drained = true;
    pipeline(
      run({
        concurrency: true,
        files,
        signal: this.#controller.signal,
        watch: true,
        testNamePatterns: this.#testsFilter,
      }),
      async function* (source) {
        for await (const data of source) {
          yield data;
          if (drained && (data.type === 'test:start' || data.type === 'test:enqueue')) {
            this.#clear();
            drained = false;
          }
          if (data.type === 'test:watch:drained') {
            // eslint-disable-next-line no-loop-func
            setImmediate(() => {
              this.#emitter.emit('drained');
              drained = true;
              this.#hooks.onTestRunComplete.forEach((fn) => fn());
            });
          }
        }
      }.bind(this),
      new SpecReporter(),
      process.stdout,
      { signal: this.#controller.signal },
    );
  }

  // eslint-disable-next-line class-methods-use-this
  #quit() {
    process.stdout.write('\n');
    process.stdin.setRawMode?.(false);
    process.exit(0);
  }

  // eslint-disable-next-line class-methods-use-this
  #clear() {
    process.stdout.write('\u001bc');
  }

  #back() {
    const current = this.#currentCommands;
    return ({ clear = true, help = true } = {}) => {
      this.#currentCommands = current;
      if (clear) {
        this.#clear();
      }
      if (help) {
        this.#help();
      }
    };
  }

  #compactHelp(char = 'w') {
    process.stdout.write(chalk.gray(`\n${chalk.white.bold('REPL Usage')}: Press ${chalk.white.bold(char)} to show more.`));
    const showMore = this.#back();
    this.#currentCommands = {
      ...this.#currentCommands,
      [char]: {
        fn: () => {
          // Remove previous lines
          process.stdout.write('\n\x1b[1A\x1b[2K\x1b[1A\x1b[2K');
          showMore({ clear: false });
        },
      },
    };
  }

  #filterPrompt({ title, subtitle }) {
    const back = this.#back();
    let input = '';
    return new Promise((resolve) => {
      this.#currentCommands = {
        [KEYS.ENTER]: {
          fn: () => {
            resolve(input);
            back({ help: false });
          },
          description: `filter by a ${subtitle} pattern.`,
        },
        [KEYS.ESC]: {
          fn: () => {
            resolve(null);
            back({ help: false });
          },
          description: 'exit pattern mode.',
        },
        [UnknownCommand]: {
          fn: (cmd) => {
            if (cmd === KEYS.BACKSPACE) {
              input = input.slice(0, -1);
              process.stdout.write('\x1b[1D \x1b[1D');
            } else {
              input += cmd;
              process.stdout.write(cmd);
            }
          },
        },
      };
      this.#clear();
      this.#help(title);
      process.stdout.write(chalk.gray('\n pattern › '));
    });
  }

  async #filterFile() {
    const input = await this.#filterPrompt({ title: 'Filter File', subtitle: 'file name' });
    if (input !== null) {
      this.#filesFilter = input;
    }
    await this.#runTests();
  }

  async #filterTest() {
    const input = await this.#filterPrompt({ title: 'Filter Test', subtitle: 'test name' });
    if (input !== null) {
      this.#testsFilter = input;
    }
    await this.#runTests();
  }

  #clearFilter() {
    this.#filesFilter = '';
    this.#testsFilter = '';
    this.#runTests();
  }

  #help(title = 'REPL Usage') {
    if (this.#filesFilter || this.#testsFilter) {
      const message = `
${chalk.white.bold('Active Filters:')} \
${this.#filesFilter ? `file name ${chalk.gray('**/')}${chalk.yellow(this.#filesFilter)}${chalk.gray('*.*')}` : ''}\
${(this.#testsFilter && this.#filesFilter) ? ', ' : ''}\
${this.#testsFilter ? `test name ${chalk.yellow(`/${this.#testsFilter}/`)}` : ''}
`;
      process.stdout.write(message);
    }
    const message = `
${chalk.bold(title)}
${Object.entries(this.#currentCommands)
    .filter(([, { active, description }]) => (!active || active()) && description)
    .map(([key, { description }]) => chalk.gray(` › Press ${chalk.white.bold(KEY_NAMES[key] || key)} to ${description}`))
    .join('\n')}
`;
    process.stdout.write(message);
  }

  async run() {
    await Promise.all([once(this.#emitter, 'drained'), this.#runTests()]);
    this.#emitter.on('drained', () => this.#compactHelp());
    this.#help();
    for await (const data of on(process.stdin, 'data')) {
      const commands = process.stdin.isRaw ? [data[0]] : data.toString().split('');
      for (const command of commands) {
        if (command === KEYS.CTRLC || command === KEYS.CTRLD) {
          this.#quit();
        }
        if (this.#currentCommands[command]) {
          this.#currentCommands[command].fn();
        } else if (this.#currentCommands[UnknownCommand]) {
          this.#currentCommands[UnknownCommand].fn(command);
        }
      }
    }
  }

  registerPlugin(plugin) {
    // TODO: should we be compatible (as much as possible) to Jest API for easy migration?
    const usageInfo = plugin.getUsageInfo();

    // TODO: enable override t,p overridable
    this.#currentCommands = Object.freeze({
      [usageInfo.key]: {
        fn: plugin.run.bind(plugin),
        description: usageInfo.description,
      },
      ...this.#currentCommands,
    });

    plugin.apply({
      shouldRunTestSuite: (fn) => this.#hooks.shouldRunTestSuite.push(fn),
      onTestRunComplete: (fn) => this.#hooks.onTestRunComplete.push(fn),
    });
  }
}

const repl = new REPL();
// TODO: only for testing/development. remove this after we have config.
repl.registerPlugin(new WatchSuspendPlugin());

repl.run()
  .then(() => process.exit(0))
  .catch((error) => {
    /* c8 ignore next 2 */
    console.error(error);
    process.exit(1);
  });
