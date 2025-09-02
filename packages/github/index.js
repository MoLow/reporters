'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');
const util = require('node:util');
const { EOL } = require('node:os');
const core = require('@actions/core');
const StackUtils = require('stack-utils');
const { Command, toCommandProperties } = require('./gh_core');

const WORKSPACE = process.env.GITHUB_WORKSPACE ?? '';

const stack = new StackUtils({ cwd: WORKSPACE, internals: StackUtils.nodeInternals() });

const isFile = (name) => name?.startsWith(WORKSPACE);

const getRelativeFilePath = (name) => (isFile(name) ? path.relative(WORKSPACE, name) : null);

function getFilePath(fileName) {
  if (fileName.startsWith('file://')) {
    return getRelativeFilePath(fileURLToPath(fileName));
  }
  if (!path.isAbsolute(fileName)) {
    return getRelativeFilePath(path.resolve(fileName) ?? '');
  }
  return getRelativeFilePath(fileName);
}

const parseStack = (error, file) => {
  const err = error?.code === 'ERR_TEST_FAILURE' ? error?.cause : error;
  const stackLines = (err?.stack ?? '').split(/\r?\n/);
  const line = stackLines.find((l) => l.includes(file)) ?? stackLines[0];
  return line ? stack.parseLine(line) : null;
};

const DIAGNOSTIC_KEYS = {
  tests: 'Total Tests',
  suites: 'Suites 📂',
  pass: 'Passed ✅',
  fail: 'Failed ❌',
  cancelled: 'Canceled 🚫',
  skipped: 'Skipped ⏭️',
  todo: 'Todo 📝',
  duration_ms: 'Duration 🕐',
};

const DIAGNOSTIC_VALUES = {
  duration_ms: (value) => `${Number(value).toFixed(3)}ms`,
};

function extractLocation(data) {
  let { line, column, file } = data;
  const error = data.details?.error;
  file = getFilePath(file);

  if (error) {
    const errorLocation = parseStack(error, file);
    file = getFilePath(errorLocation?.file ?? file) ?? file;
    line = errorLocation?.line ?? line;
    column = errorLocation?.column ?? column;
  }

  return { file, startLine: line, startColumn: column };
}

const counter = { pass: 0, fail: 0 };
const diagnostics = [];

function isTopLevelDiagnostic(data) {
  return (data.file === undefined
          || data.line === undefined
          || data.column === undefined
          || (data.line === 1 && data.column === 1));
}

function transformEvent(event) {
  switch (event.type) {
    case 'test:start':
      return new Command('debug', {}, `starting to run ${event.data.name}`).toString();
    case 'test:pass':
      counter.pass += 1;
      return new Command('debug', {}, `completed running ${event.data.name}`).toString();
    case 'test:fail': {
      const error = event.data.details?.error;
      if (error?.code === 'ERR_TEST_FAILURE' && error?.failureType === 'subtestsFailed') {
        // This means the failed subtests are already reported
        // no need to re-annotate the file itself
        break;
      }
      const err = error.code === 'ERR_TEST_FAILURE' ? error.cause : error;
      counter.fail += 1;
      return new Command('error', toCommandProperties({
        ...extractLocation(event.data),
        title: event.data.name,
      }), util.inspect(err, { colors: true, breakLength: Infinity })).toString();
    } case 'test:diagnostic':
      if (isTopLevelDiagnostic(event.data)) {
        diagnostics.push(event.data.message);
      } else if (process.env.GITHUB_ACTIONS_REPORTER_VERBOSE) {
        return new Command('notice', toCommandProperties(extractLocation(event.data)), `${event.data.message}`).toString();
      }
      break;
    default:
      break;
  }
  return '';
}

async function getSummary() {
  const formattedDiagnostics = diagnostics.map((d) => {
    const [key, ...rest] = d.split(' ');
    const value = rest.join(' ');
    return [
      DIAGNOSTIC_KEYS[key] ?? key,
      DIAGNOSTIC_VALUES[key] ? DIAGNOSTIC_VALUES[key](value) : value,
    ];
  });
  let res = '';
  res += new Command('group', {}, `Test results (${formattedDiagnostics.find(([key]) => key === DIAGNOSTIC_KEYS.pass)?.[1] ?? counter.pass} passed, ${formattedDiagnostics.find(([key]) => key === DIAGNOSTIC_KEYS.fail)?.[1] ?? counter.fail} failed)`).toString();
  res += new Command('notice', {}, formattedDiagnostics.map((d) => d.join(': ')).join(EOL)).toString();
  res += new Command('endgroup').toString();

  if (process.env.GITHUB_STEP_SUMMARY) {
    await core.summary
      .addHeading('Test Results')
      .addTable(formattedDiagnostics)
      .write();
  }
  return res;
}

module.exports = async function* githubReporter(source) {
  if (!process.env.GITHUB_ACTIONS) {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of source);
    return;
  }
  for await (const event of source) {
    yield transformEvent(event);
  }
  yield await getSummary();
};

module.exports.transformEvent = transformEvent;
module.exports.getSummary = getSummary;
module.exports.isTopLevelDiagnostic = isTopLevelDiagnostic;
module.exports.DIAGNOSTIC_VALUES = DIAGNOSTIC_VALUES;
