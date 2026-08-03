import util from 'node:util';
import { hostname } from 'node:os';

const HOSTNAME = hostname();

function escapeProperty(s = '') {
  return s.replace(/"/g, '\\"').replace(/\n/g, '');
}

function escapeContent(s = '') {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeComment(s = '') {
  return s.replace(/--/g, '&#45;&#45;');
}

function treeToXML(tree) {
  if (typeof tree === 'string') {
    return `${escapeContent(tree)}\n`;
  }
  const {
    tag, props, nesting, children, comment,
  } = tree;
  const indent = '\t'.repeat(nesting + 1);
  if (comment) {
    return `${indent}<!-- ${escapeComment(comment)} -->\n`;
  }
  const propsString = Object.entries(props)
    .map(([key, value]) => `${key}="${escapeProperty(String(value))}"`)
    .join(' ');
  if (!children?.length) {
    return `${indent}<${tag} ${propsString}/>\n`;
  }
  const childrenString = `${(children ?? []).map(treeToXML).join('')}`;
  return `${indent}<${tag} ${propsString}>\n${childrenString}${indent}</${tag}>\n`;
}

// `test:log` is execution-ordered - Node forwards it the moment `t.log()` runs,
// bypassing the per-file declaration-order buffer that `test:diagnostic` waits
// in. Appending it on arrival puts the comment beside whichever test happens to
// be reporting, so logs are held and attached to their own test instead.
// `entryFile` (nodejs/node#64309) will disambiguate the isolated processes that
// share a declaration file; until it lands, `(file, testId)` can collide.
const logKey = (data) => `${data.entryFile ?? data.file} ${data.testId}`;

function isFailure(node) {
  return (node?.children && node.children.some((c) => c.tag === 'failure')) || node?.props?.failures;
}

function isSkipped(node) {
  return (node?.children && node.children.some((c) => c.tag === 'skipped')) || node?.props?.skipped;
}

export default async function* junitReporter(source) {
  yield '<?xml version="1.0" encoding="utf-8"?>\n';
  yield '<testsuites>\n';
  let currentSuite = null;
  const roots = [];
  const pendingLogs = new Map();
  let orphanLogs = 0;

  function pushLog(data) {
    // A log with no `testId` can never be claimed by a reported test, so it gets
    // a key nothing matches and surfaces at the end of the run instead.
    orphanLogs += data.testId === undefined ? 1 : 0;
    const key = data.testId === undefined ? ` orphan ${orphanLogs}` : logKey(data);
    const logs = pendingLogs.get(key);
    if (logs === undefined) {
      pendingLogs.set(key, [data.message]);
    } else {
      logs.push(data.message);
    }
  }

  function takeLogs(data) {
    if (data.testId === undefined) {
      return [];
    }
    const key = logKey(data);
    const logs = pendingLogs.get(key);
    if (logs === undefined) {
      return [];
    }
    pendingLogs.delete(key);
    return logs;
  }

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
        const nonCommentChildren = currentTest.children.filter((c) => c.comment == null);
        if (nonCommentChildren.length > 0) {
          currentTest.tag = 'testsuite';
          currentTest.props.disabled = 0;
          currentTest.props.errors = 0;
          currentTest.props.tests = nonCommentChildren.length;
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
        // After the tag is decided: comments are excluded from the child count
        // that distinguishes a testcase from a testsuite, so a logged test must
        // not become a suite.
        for (const message of takeLogs(event.data)) {
          currentTest.children.push({ nesting: event.data.nesting + 1, comment: message });
        }
        break;
      }
      case 'test:diagnostic': {
        const parent = currentSuite?.children ?? roots;
        parent.push({ nesting: event.data.nesting, comment: event.data.message });
        break;
      }
      case 'test:log': {
        pushLog(event.data);
        break;
      }
      default:
        break;
    }
  }
  // Logs whose test never reported - an interrupted run, or `t.log()` from an
  // async leak that outlived its test.
  for (const logs of pendingLogs.values()) {
    for (const message of logs) {
      roots.push({ nesting: 0, comment: message });
    }
  }
  for (const suite of roots) {
    yield treeToXML(suite);
  }
  yield '</testsuites>\n';
}
