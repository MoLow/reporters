/* eslint-disable no-underscore-dangle */

import { styleText } from 'node:util';
import { Transform } from 'node:stream';
import { spec as Spec } from 'node:test/reporters';
import {
  getSummary, transformEvent, isTopLevelDiagnostic, DIAGNOSTIC_VALUES,
} from '@reporters/github';
import { Command } from '@reporters/github/gh_core';

const diagnosticColorMap = { __proto__: null, warn: 'yellow', error: 'red' };

const indentMemo = new Map();
function indent(nesting) {
  let value = indentMemo.get(nesting);
  if (value === undefined) {
    value = '  '.repeat(nesting);
    indentMemo.set(nesting, value);
  }
  return value;
}

const formatDuration = (m) => {
  let ms = m;
  if (ms < 0) ms = -ms;
  const time = {
    day: Math.floor(ms / 86400000),
    hour: Math.floor(ms / 3600000) % 24,
    minute: Math.floor(ms / 60000) % 60,
    second: Math.floor(ms / 1000) % 60,
    millisecond: Math.floor(ms) % 1000,
  };
  if (ms < 1 && ms > 0) {
    return `${ms.toFixed(3)} milliseconds`;
  }
  if (time.day !== 0 || time.hour !== 0 || time.minute !== 0 || time.second !== 0) {
    /* c8 ignore next 2 */
    time.millisecond = 0;
  }
  return Object.entries(time)
    .filter((val) => val[1] !== 0)
    .map(([key, val]) => `${val} ${key}${val !== 1 ? 's' : ''}`)
    .join(', ');
};

const endGroup = new Command('endgroup').toString();

// eslint-disable-next-line no-control-regex
const ansi = /\[[0-9;]*m/g;

// The upstream reporter renders durations as `(<ms>ms)`; rewrite them to the
// humanized form used across the GitHub reporter.
function rewriteDuration(text) {
  return text.replace(/\(([0-9]+(?:\.[0-9]+)?)ms\)/g, (_, ms) => `(${formatDuration(Number(ms))})`);
}

// Separate the upstream per-test output into its parent `▶` prefix lines and the
// final result line, so the result line can be wrapped in a group.
function splitReport(text) {
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  const idx = body.lastIndexOf('\n');
  return idx === -1
    ? { prefix: '', header: body }
    : { prefix: body.slice(0, idx + 1), header: body.slice(idx + 1) };
}

class SpecReporter extends Transform {
  #isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);

  #specReporter;

  #reportedGroup = false;

  constructor() {
    super({ __proto__: null, writableObjectMode: true });
    DIAGNOSTIC_VALUES.duration_ms = formatDuration;
    if (this.#isGitHubActions) {
      // GitHub Actions renders ANSI but isn't a TTY, so the upstream reporter
      // would otherwise emit no color. Force it on before constructing it.
      process.env.FORCE_COLOR ??= '1';
    }
    this.#specReporter = new Spec();
  }

  // Delegate to the upstream `spec` reporter and capture the text it would emit
  // for a single event. The inner reporter keeps its own stack/state, so feeding
  // it every test event keeps its prefix/nesting bookkeeping correct.
  #specOutput(type, data) {
    let out = '';
    this.#specReporter._transform({ __proto__: null, type, data }, null, (err, chunk) => {
      if (err) throw err;
      if (chunk) out = chunk;
    });
    return out;
  }

  #group(prefix, header, trailer = '') {
    if (!this.#isGitHubActions) {
      return `${prefix}${header}${trailer}`;
    }
    const eg = this.#reportedGroup ? endGroup : '';
    this.#reportedGroup = true;
    return `${eg}${prefix}${new Command('group', {}, header, { EOL: '' }).toString()}${trailer}`;
  }

  // The upstream reporter emits the whole "failing tests:" section (headers and
  // error bodies). Wrap each failed test's header line in a group for GitHub
  // Actions; the parent's open group is closed first.
  #reshapeFailures(text) {
    const block = rewriteDuration(text);
    if (!this.#isGitHubActions) {
      return block;
    }
    if (block === '') {
      return this.#reportedGroup ? endGroup : '';
    }
    let result = this.#reportedGroup ? `${endGroup}\n` : '';
    this.#reportedGroup = false;
    const lines = block.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const plain = line.replace(ansi, '');
      if (/^[✖⚠] /.test(plain) && !/failing tests:$/.test(plain)) {
        const eg = this.#reportedGroup ? endGroup : '';
        this.#reportedGroup = true;
        lines[i] = `${eg}${new Command('group', {}, line, { EOL: '' }).toString()}`;
      }
    }
    result += lines.join('\n');
    if (this.#reportedGroup) {
      result += `\n${endGroup}`;
    }
    return result;
  }

  #handleEvent({ type, data }) {
    let res = '';
    if (this.#isGitHubActions) {
      res = transformEvent({ type, data });
    }
    switch (type) {
      case 'test:fail':
      case 'test:pass': {
        const { prefix, header } = splitReport(rewriteDuration(this.#specOutput(type, data)));
        return this.#group(prefix, header, '\n') + res;
      }
      case 'test:start':
        // Feed the event to the upstream reporter so it can track nesting, but it
        // emits nothing for `test:start` itself.
        this.#specOutput(type, data);
        return res;
      case 'test:diagnostic': {
        if (isTopLevelDiagnostic(data)) {
          return res;
        }
        const diagnosticColor = diagnosticColorMap[data.level] || 'white';
        return `${res}${indent(data.nesting)}${styleText(diagnosticColor, `${data.message}`, { validateStream: !this.#isGitHubActions })}\n`;
      }
      case 'test:summary':
        // We report only the root test summary
        if (data.file === undefined) {
          /* c8 ignore next 2 */
          return this.#reshapeFailures(this.#specOutput(type, data));
        }
        break;
      /* c8 ignore next 2 */
      case 'test:interrupted':
        return this.#reshapeInterrupted(this.#specOutput(type, data)) + res;
      default:
    }
    return ''; // No output for other event types
  }

  // The upstream reporter formats the interrupted-tests block; close any open
  // group before it for GitHub Actions.
  /* c8 ignore start */
  #reshapeInterrupted(text) {
    if (text === '' || !this.#isGitHubActions || !this.#reportedGroup) {
      return text;
    }
    this.#reportedGroup = false;
    return `${endGroup}\n${text}`;
  }
  /* c8 ignore stop */

  _transform({ type, data }, encoding, callback) {
    if (type === 'test:coverage' || type === 'test:stderr' || type === 'test:stdout') {
      /* c8 ignore next 3 */
      this.#specReporter._transform({ type, data }, encoding, callback);
      return;
    }
    callback(null, this.#handleEvent({ __proto__: null, type, data }));
  }

  _flush(callback) {
    let failures = '';
    this.#specReporter._flush((err, chunk) => {
      if (err) throw err;
      if (chunk) failures = chunk;
    });
    Promise.resolve(this.#isGitHubActions ? getSummary() : '').then((summary) => {
      callback(null, this.#reshapeFailures(failures) + summary);
    }).catch((err) => {
      /* c8 ignore next 2 */
      callback(err);
    });
  }
}

export default new SpecReporter();
