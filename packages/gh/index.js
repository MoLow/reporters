'use strict';

/* eslint-disable no-underscore-dangle */

const assert = require('node:assert');
const { styleText, inspect } = require('node:util');
const { Transform } = require('node:stream');
const { relative } = require('node:path');
// eslint-disable-next-line import/no-unresolved
const { spec: Spec } = require('node:test/reporters');
const { emitSummary, handleEvent, isTopLevelDiagnostic } = require('@reporters/github');

const reporterColorMap = {
  'test:fail': 'red',
  'test:pass': 'green',
  'test:diagnostic': 'white',
  warn: 'yellow',
  error: 'red',
  info: 'white',
};

const reporterUnicodeSymbolMap = {
  'test:fail': '\u2716 ',
  'test:pass': '\u2714 ',
  'test:coverage': '\u2139 ',
  'arrow:right': '\u25B6 ',
  'hyphen:minus': '\uFE63 ',
};

const indentMemo = new Map();
function indent(nesting) {
  let value = indentMemo.get(nesting);
  if (value === undefined) {
    value = '  '.repeat(nesting);
    indentMemo.set(nesting, value);
  }
  return value;
}

function inspectWithNoCustomRetry(obj, options) {
  try {
    return inspect(obj, options);
  } catch {
    /* c8 ignore next 2 */
    return inspect(obj, { ...options, customInspect: false });
  }
}

const inspectOptions = {
  __proto__: null,
  breakLength: Infinity,
};

function formatError(error, indentation) {
  if (!error) return '';
  const err = error.code === 'ERR_TEST_FAILURE' ? error.cause : error;
  const message = inspectWithNoCustomRetry(err, inspectOptions).split(/\r?\n/).join(`\n${indentation}  `);
  return `\n${indentation}  ${message}\n`;
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

class SpecReporter extends Transform {
  #isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);

  #specReporter = new Spec();

  #stack = [];

  #reported = [];

  #failedTests = [];

  #cwd = process.cwd();

  #reportedGroup = false;

  constructor() {
    super({ __proto__: null, writableObjectMode: true });
    if (this.#isGitHubActions) {
      inspectOptions.colors = true;
    }
  }

  #formatTestReport(type, data, prefix = '', indentation = '', hasChildren = false, showErrorDetails = true) {
    let color = reporterColorMap[type] ?? 'white';
    let symbol = reporterUnicodeSymbolMap[type] ?? ' ';
    const { skip, todo } = data;
    const durationMs = data.details?.duration_ms ? styleText(['gray', 'italic'], ` (${formatDuration(data.details.duration_ms)})`, { validateStream: !this.#isGitHubActions }) : '';
    let title = `${data.name}${durationMs}`;

    if (skip !== undefined) {
      title += ` # ${typeof skip === 'string' && skip.length ? skip : 'SKIP'}`;
    } else if (todo !== undefined) {
      title += ` # ${typeof todo === 'string' && todo.length ? todo : 'TODO'}`;
    }

    const error = showErrorDetails ? formatError(data.details?.error, indentation) : '';
    let err = error;
    if (hasChildren) {
      err = !error || data.details?.error?.failureType === 'subtestsFailed' ? '' : `\n${error}`;
    }

    if (skip !== undefined) {
      color = 'gray';
      symbol = reporterUnicodeSymbolMap['hyphen:minus'];
    }

    let ghGroup = '';
    let p = prefix;
    if (this.#isGitHubActions) {
      ghGroup = '::group::';
      if (this.#reportedGroup) {
        p = `::endgroup::\n${prefix}`;
      }
      this.#reportedGroup = true;
    }
    return `${p}${ghGroup}${indentation}${styleText(color, `${symbol}${title}`, { validateStream: !this.#isGitHubActions })}${err}`;
  }

  #formatFailedTestResults() {
    if (this.#failedTests.length === 0) {
      /* c8 ignore next 2 */
      return this.#reportedGroup ? '::endgroup::\n' : '';
    }

    const results = [
      `\n${styleText('red', `${reporterUnicodeSymbolMap['test:fail']}failing tests:`, { validateStream: !this.#isGitHubActions })}\n`,
    ];

    if (this.#reportedGroup) {
      results.unshift('::endgroup::\n');
      this.#reportedGroup = false; // Reset the group state for the next run
    }

    for (let i = 0; i < this.#failedTests.length; i += 1) {
      const test = this.#failedTests[i];
      const formattedErr = this.#formatTestReport('test:fail', test);

      if (test.file) {
        const relPath = relative(this.#cwd, test.file);
        const location = `test at ${relPath}:${test.line}:${test.column}`;
        results.push(location);
      }

      results.push(formattedErr);
    }

    if (this.#reportedGroup) {
      results.push('::endgroup::\n');
    }

    this.#failedTests = []; // Clean up the failed tests
    return results.join('\n');
  }

  #handleTestReportEvent(type, data) {
    const subtest = this.#stack.shift(); // This is the matching `test:start` event
    if (subtest) {
      assert(subtest.type === 'test:start');
      assert(subtest.data.nesting === data.nesting);
      assert(subtest.data.name === data.name);
    }
    let prefix = '';
    while (this.#stack.length) {
      // Report all the parent `test:start` events
      const parent = this.#stack.pop();
      assert(parent.type === 'test:start');
      const msg = parent.data;
      this.#reported.unshift(msg);
      if (this.#isGitHubActions) {
        prefix += `${reporterUnicodeSymbolMap['arrow:right']}${indent(msg.nesting)}${msg.name}\n`;
      } else {
        prefix += `${indent(msg.nesting)}${reporterUnicodeSymbolMap['arrow:right']}${msg.name}\n`;
      }
    }
    let hasChildren = false;
    if (this.#reported[0] && this.#reported[0].nesting === data.nesting
       && this.#reported[0].name === data.name) {
      this.#reported.shift();
      hasChildren = true;
    }
    const indentation = indent(data.nesting);
    return `${this.#formatTestReport(type, data, prefix, indentation, hasChildren, false)}\n`;
  }

  #handleEvent({ type, data }) {
    if (this.#isGitHubActions) {
      handleEvent({ type, data });
    }
    switch (type) {
      case 'test:fail':
        if (data.details?.error?.failureType !== 'subtestsFailed') {
          this.#failedTests.push(data);
        }
        return this.#handleTestReportEvent(type, data);
      case 'test:pass':
        return this.#handleTestReportEvent(type, data);
      case 'test:start':
        this.#stack.unshift({ __proto__: null, data, type });
        break;
      case 'test:diagnostic': {
        if (isTopLevelDiagnostic(data)) {
          return '';
        }
        const diagnosticColor = reporterColorMap[data.level] || reporterColorMap.info;
        return `${indent(data.nesting)}${styleText(diagnosticColor, `${reporterUnicodeSymbolMap[type] ?? ''}${data.message}`, { validateStream: !this.#isGitHubActions })}\n`;
      }
      case 'test:summary':
        // We report only the root test summary
        if (data.file === undefined) {
          /* c8 ignore next 2 */
          return this.#formatFailedTestResults();
        }
        break;
      default:
    }
    return ''; // No output for other event types
  }

  _transform({ type, data }, encoding, callback) {
    if (type === 'test:coverage' || type === 'test:stderr' || type === 'test:stdout') {
      /* c8 ignore next 3 */
      this.#specReporter._transform({ type, data }, encoding, callback);
      return;
    }
    callback(null, this.#handleEvent({ __proto__: null, type, data }));
  }

  _flush(callback) {
    callback(null, this.#formatFailedTestResults());
    if (this.#isGitHubActions) {
      emitSummary();
    }
  }
}

module.exports = new SpecReporter();
