const path = require('node:path');
const util = require('node:util');
const { EOL } = require('node:os');
const StackUtils = require('stack-utils');


const WORKSPACE = process.env['GITHUB_WORKSPACE'] ?? '';

const stack = new StackUtils({ cwd: WORKSPACE, internals: StackUtils.nodeInternals() });

const getCurrentFile =(name) => isFile(name) ? path.relative(WORKSPACE, name) : null;

const isFile = (name) => name?.startsWith(WORKSPACE);

const parseStack = (error, file) => {
  const stackLines = (error?.stack ?? '').split(/\r?\n/);
  const line = stackLines.find(line => line.includes(file)) ??  stackLines[0];
  return line ? stack.parseLine(line) : null;
};

const escapeData = (s = '') => s
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');

const escapeProperty = (s = '') => escapeData(s)
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');

const propsToString = (props = {}) => {
  const entries = Object.entries(props);
  if (entries.length === 0) {
    return '';
  }

  const result = entries
    .filter(([key, value]) => Boolean(value))
    .map(([key, value]) => `${key}=${escapeProperty(String(value))}`).join(',');

  return ` ${result}`;
}

const report = (command, message, pros) => process.stdout.write(`::${command}::${propsToString(pros)}::${escapeData(message)}${EOL}`);

module.exports = async function * customReporter(source) {
  const counter = { pass: 0, fail: 0 };
  const diagnostics = [];
  let currentFile = null;
  for await (const event of source) {
    switch (event.type) {
      case 'test:start':
        currentFile = getCurrentFile(event.data.name) || currentFile;
        report('debug', `starting to run ${event.data.name}`);
        break;
      case 'test:pass':
        counter.pass++;
        report('debug', `completed running ${event.data.name}`);
        currentFile = isFile(event.data.name) ? null : currentFile;
        break;
      case 'test:fail':
        const error = util.inspect(event.data.details?.error, { colors: false, breakLength: Infinity  });
        const location = parseStack(event.data.details?.error, currentFile);
        report('error', error, { file: location?.file ?? currentFile, line: location?.line, col: location?.column, title: event.data.name });
        counter.fail++;
        currentFile = isFile(event.data.name) ? null : currentFile;
        break;
      case 'test:diagnostic':
        if (currentFile) {
          report('notice', event.data.message, { file: currentFile });
        } else {
          diagnostics.push(event.data.message);
        }
        break;
    }
  }
  report('group', `Test results (${counter.pass} passed, ${counter.fail} failed)`);
  for (const diagnostic of diagnostics) {
    report('notice', diagnostic);
  }
  console.log('::endgroup::');
}