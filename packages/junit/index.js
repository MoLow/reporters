'use strict';

const util = require('node:util');
const { hostname } = require('node:os');

const HOSTNAME = hostname();

function escapeProperty(s = '') {
  return s.replace(/"/g, '\\"').replace(/\n/g, '');
}

function escapeContent(s = '') {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function treeToXML(tree) {
  if (typeof tree === 'string') {
    return `${escapeContent(tree)}\n`;
  }
  const {
    tag, props, nesting, children,
  } = tree;
  const propsString = Object.entries(props)
    .map(([key, value]) => `${key}="${escapeProperty(String(value))}"`)
    .join(' ');
  const indent = '\t'.repeat(nesting + 1);
  if (!children?.length) {
    return `${indent}<${tag} ${propsString}/>\n`;
  }
  const childrenString = `${(children ?? []).map(treeToXML).join('')}`;
  return `${indent}<${tag} ${propsString}>\n${childrenString}${indent}</${tag}>\n`;
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
  const roots = [];

  function startTest(event) {
    const originalSuite = currentSuite;
    currentSuite = {
      props: { name: event.data.name },
      nesting: event.data.nesting,
      parent: currentSuite,
      children: [],
    };
    originalSuite?.children.push(currentSuite);
    if (!currentSuite.parent) {
      roots.push(currentSuite);
    }
  }

  for await (const event of source) {
    switch (event.type) {
      case 'test:start': {
        startTest(event);
        break;
      }
      case 'test:pass':
      case 'test:fail': {
        if (!currentSuite) {
          startTest({ data: { name: 'root', nesting: 0 } });
        }
        if (currentSuite.props.name !== event.data.name
          || currentSuite.nesting !== event.data.nesting) {
          startTest(event);
        }
        const currentTest = currentSuite;
        if (currentSuite?.nesting === event.data.nesting) {
          currentSuite = currentSuite.parent;
        }
        currentTest.props.time = (event.data.details.duration_ms / 1000).toFixed(6);
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
          currentTest.props.classname = event.data.classname ?? 'test';
          if (event.data.skip) {
            currentTest.children.push({ nesting: event.data.nesting + 1, tag: 'skipped', props: { type: 'skipped', message: event.data.skip } });
          }
          if (event.data.todo) {
            currentTest.children.push({ nesting: event.data.nesting + 1, tag: 'skipped', props: { type: 'todo', message: event.data.todo } });
          }
          if (event.type === 'test:fail') {
            const error = event.data.details?.error;
            currentTest.children.push({
              nesting: event.data.nesting + 1,
              tag: 'failure',
              props: { type: error?.failureType || error?.code, message: error?.message ?? '' },
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
  for (const suite of roots) {
    yield treeToXML(suite);
  }
  yield '</testsuites>\n';
};
