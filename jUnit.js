const assert = require('node:assert');
const util = require('node:util');
const { hostname } = require('node:os');

const HOSTNAME = hostname();

function escapeProperty(s = '') {
  return s.replace(/"/g, '\\"');
}

function escapeContent(s = '') {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function treeToXML(tree) {
  if (typeof tree === 'string') {
    return escapeContent(tree);
  }
  const {
    tag, props, nesting, children,
  } = tree;
  const propsString = Object.entries(props)
    .map(([key, value]) => `${key}="${escapeProperty(String(value))}"`)
    .join(' ');
  const indent = '  '.repeat(nesting + 1);
  const newLine = children?.length ? '\n' : '';
  const postIndent = newLine ? indent : '';
  const postNewLine = newLine ? '' : '\n';
  const childrenString = `${newLine}${(children ?? []).map(treeToXML).join('')}${newLine}${postIndent}`;
  return `${indent}<${tag} ${propsString}>${childrenString}</${tag}>${postNewLine}`;
}

function isFailure(node) {
  return node?.children.some((c) => c.tag === 'failure') || node?.props?.failures;
}

function isSkipped(node) {
  return node?.children.some((c) => c.tag === 'skipped') || node?.props?.skipped;
}

module.exports = async function* junitReporter(source) {
  yield '<?xml version="1.0" encoding="utf-8"?>\n';
  yield '<testsuites>\n';
  let currentSuite = null;
  for await (const event of source) {
    switch (event.type) {
      case 'test:start': {
        const originalSuite = currentSuite;
        currentSuite = {
          props: { name: event.data.name },
          nesting: event.data.nesting,
          parent: currentSuite,
          children: [],
        };
        originalSuite?.children.push(currentSuite);
        break;
      }
      case 'test:pass':
      case 'test:fail': {
        const currentTest = currentSuite;
        if (currentSuite?.nesting === event.data.nesting && currentSuite?.parent) {
          currentSuite = currentSuite.parent;
        }
        assert.strictEqual(currentTest.props.name, event.data.name);
        currentTest.props.time = (event.data.details.duration_ms / 1000).toFixed(5);
        if (currentTest.children.length > 0) {
          currentTest.tag = 'testsuite';
          currentTest.props.disabled = 0;
          currentTest.props.errors = 0;
          currentTest.props.tests = currentTest.children.length;
          currentTest.props.failures = currentTest.children.filter(isFailure).length;
          currentTest.props.skipped = currentTest.children.filter(isSkipped).length;
          currentTest.props.hostname = HOSTNAME;
        } else {
          currentTest.tag = 'testcase';
          currentTest.props.classname = 'test';
          if (event.data.skip) {
            currentTest.children.push({ nesting: event.data.nesting + 1, tag: 'skipped', props: { message: event.data.skip } });
          }
          if (event.data.todo) {
            currentTest.children.push({ nesting: event.data.nesting + 1, tag: 'skipped', props: { message: event.data.todo } });
          }
          if (event.type === 'test:fail') {
            const error = event.data.details?.error;
            currentTest.children.push({
              nesting: event.data.nesting + 1,
              tag: 'failure',
              props: { message: error?.message ?? '', type: error.failureType || error.code },
              children: [util.inspect(
                event.data.details?.error,
                { colors: false, breakLength: Infinity },
              )],
            });
            currentTest.failures = 1;
            currentTest.props.failure = event.data.details?.error?.message ?? '';
          }
        }
        break;
      }
      case 'test:diagnostic':
        break;
      default:
        break;
    }
  }
  yield treeToXML(currentSuite);
  yield '\n</testsuites>\n';
};
