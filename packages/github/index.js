const path = require('node:path');
const util = require('node:util');
const { EOL } = require('node:os');
const core = require('@actions/core');
const StackUtils = require('stack-utils');

const WORKSPACE = process.env.GITHUB_WORKSPACE ?? '';

const stack = new StackUtils({ cwd: WORKSPACE, internals: StackUtils.nodeInternals() });

const isFile = (name) => name?.startsWith(WORKSPACE);

const getFilePath = (name) => (isFile(name) ? path.relative(WORKSPACE, require.resolve(name) ?? '') : null);

const parseStack = (error, file) => {
  const stackLines = (error?.stack ?? '').split(/\r?\n/);
  const line = stackLines.find((l) => l.includes(file)) ?? stackLines[0];
  return line ? stack.parseLine(line) : null;
};

const DIAGNOSTIC_KEYS = {
  tests: 'Total Tests',
  pass: 'Passed ✅',
  fail: 'Failed ❌',
  cancelled: 'Canceled 🚫',
  skipped: 'Skipped ⏭️',
  todo: 'Todo 📝',
  duration_ms: 'Duration',
};

const DIAGNOSTIC_VALUES = {
  duration_ms: (value) => `${Number(value).toFixed(3)}ms`,
};

module.exports = async function githubReporter(source) {
  const counter = { pass: 0, fail: 0 };
  const diagnostics = [];
  for await (const event of source) {
    switch (event.type) {
      case 'test:start':
        core.debug(`starting to run ${event.data.name}`);
        break;
      case 'test:pass':
        counter.pass += 1;
        core.debug(`completed running ${event.data.name}`);
        break;
      case 'test:fail': {
        const error = util.inspect(
          event.data.details?.error,
          { colors: false, breakLength: Infinity },
        );
        const location = parseStack(event.data.details?.error, getFilePath(event.data.file));
        core.error(error, {
          file: location?.file ?? getFilePath(event.data.file),
          startLine: location?.line,
          startColumn: location?.column,
          title: event.data.name,
        });
        counter.fail += 1;
        break;
      } case 'test:diagnostic':
        core.notice(event.data.message, { file: getFilePath(event.data.file) });
        if (event.data.nesting === 0) {
          diagnostics.push(event.data.message);
        }
        break;
      default:
        break;
    }
  }
  core.startGroup(`Test results (${counter.pass} passed, ${counter.fail} failed)`);
  const formatedDiagnostics = diagnostics.map((d) => {
    const [key, ...rest] = d.split(' ');
    const value = rest.join(' ');
    return [
      DIAGNOSTIC_KEYS[key] ?? key,
      DIAGNOSTIC_VALUES[key] ? DIAGNOSTIC_VALUES[key](value) : value,
    ];
  });
  core.notice(formatedDiagnostics.map((d) => d.join(': ')).join(EOL));
  core.endGroup();

  if (process.env.GITHUB_STEP_SUMMARY) {
    await core.summary
      .addHeading('Test Results')
      .addTable(formatedDiagnostics)
      .write();
  }
};
