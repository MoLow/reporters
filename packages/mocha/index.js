/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */

'use strict';

const { EventEmitter } = require('node:events');
const Mocha = require('mocha');
const { loadOptions } = require('mocha/lib/cli');

const {
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PENDING,
  EVENT_TEST_PASS,
  EVENT_TEST_BEGIN,
  EVENT_TEST_END,
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
} = Mocha.Runner.constants;

const {
  STATE_FAILED,
  STATE_PASSED,
  STATE_PENDING,
} = Mocha.Runnable.constants;

class Test {
  #mochaOptions;

  constructor(parent = null, mochaOptions = {}) {
    this.title = '';
    this.file = '';
    this.pending = false;
    this.duration = 0;
    this.err = null;
    this.nesting = 0;
    this.parent = parent;
    this.root = !parent;
    this.children = [];
    this.kind = 'test';
    this.started = false;
    this.#mochaOptions = mochaOptions;

    this.body = '';
    this._beforeAll = [];
    this._beforeEach = [];
    this._afterAll = [];
    this._afterEach = [];
  }

  applyStartEvent(event) {
    this.title = event.data.name;
    this.file = event.data.file;
    this.nesting = event.data.nesting;
  }

  applyTestEvent(event, passed) {
    this.applyStartEvent(event);
    this.pending = Boolean(event.data.skip || event.data.todo);
    this.duration = event.data.details?.duration_ms;
    const error = event.data.details?.error;
    this.err = error?.cause instanceof Error ? error.cause : error;
    this.passed = passed;
  }

  get state() {
    if (this.pending) {
      return STATE_PENDING;
    }
    if (this.passed) {
      return STATE_PASSED;
    }
    return STATE_FAILED;
  }

  isPending() {
    return this.pending;
  }

  slow() {
    return this.#mochaOptions.slow ?? 75;
  }

  currentRetry() {
    return 0;
  }

  titlePath() {
    const parentTitle = this.parent?.titlePath() ?? [];
    return parentTitle.concat(this.title);
  }

  fullTitle() {
    return this.titlePath().join(' ');
  }

  markSuite() {
    this.kind = 'suite';
  }

  beginSuite() {
    this.markSuite();
    this.started = true;
  }

  get isSuite() {
    return this.kind === 'suite';
  }

  get suites() {
    return this.children.filter((child) => child.isSuite);
  }

  get tests() {
    return this.children.filter((child) => !child.isSuite);
  }
}

class Runner extends EventEmitter {
  stats = {
    suites: 0,
    tests: 0,
    passes: 0,
    pending: 0,
    failures: 0,
    start: new Date(),
    end: null,
    duration: null,
  };

  #reporter;

  #mochaOptions = loadOptions([]);

  #root = new Test(null, this.#mochaOptions);

  #activeNodes = [];

  constructor() {
    super();
    this.#root.markSuite();
  }

  async init() {
    const reporterName = this.#mochaOptions.reporter ?? 'spec';
    let Reporter;
    if (typeof reporterName === 'function') {
      Reporter = reporterName;
    } else if (Mocha.reporters[reporterName]) {
      Reporter = Mocha.reporters[reporterName];
    } else {
      try {
        Reporter = await import(reporterName).then((m) => m.default || m);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    }
    if (!Reporter) {
      // eslint-disable-next-line no-console
      console.error(new Error(`invalid reporter "${reporterName}"`));
      return;
    }
    this.#reporter = new Reporter(this, this.#mochaOptions);
    this.emit(EVENT_RUN_BEGIN);
  }

  get suite() {
    return this.#root;
  }

  end() {
    if (!this.#reporter) {
      return;
    }
    this.#closeActiveSuites();
    this.stats.end = new Date();
    this.stats.duration = this.stats.end - this.stats.start;
    this.#startRootSuite();
    this.emit(EVENT_SUITE_END, this.#root);
    this.emit(EVENT_RUN_END);
    if (typeof this.#reporter.done === 'function') {
      this.#reporter.done(this.stats.failures, () => {});
    }
  }

  #startRootSuite() {
    if (this.#root.started) {
      return;
    }
    this.#root.beginSuite();
    this.emit(EVENT_SUITE_BEGIN, this.#root);
  }

  #findParent(nesting) {
    if (nesting === 0) {
      return this.#root;
    }
    return this.#activeNodes[nesting - 1] ?? this.#root;
  }

  #matchesNode(node, event) {
    return node
      && node.nesting === event.data.nesting
      && node.title === event.data.name;
  }

  #ensureNode(event) {
    const { nesting } = event.data;
    const existingNode = this.#activeNodes[nesting];
    if (this.#matchesNode(existingNode, event)) {
      return existingNode;
    }

    const parent = this.#findParent(nesting);
    const node = new Test(parent, this.#mochaOptions);
    node.applyStartEvent(event);
    parent.children.push(node);
    this.#activeNodes[nesting] = node;
    this.#activeNodes.length = nesting + 1;
    return node;
  }

  #openSuite(node) {
    if (node.started) {
      return;
    }
    node.beginSuite();
    this.emit(EVENT_SUITE_BEGIN, node);
  }

  #ensureOpenAncestors(nesting) {
    for (let i = 0; i < nesting; i += 1) {
      const node = this.#activeNodes[i];
      if (node) {
        this.#openSuite(node);
      }
    }
  }

  #trimActiveNodes() {
    while (
      this.#activeNodes.length > 0
      && this.#activeNodes[this.#activeNodes.length - 1] === undefined
    ) {
      this.#activeNodes.pop();
    }
  }

  #reportTest(node) {
    this.stats.tests += 1;
    this.emit(EVENT_TEST_BEGIN, node);
    if (node.pending) {
      this.stats.pending += 1;
      this.emit(EVENT_TEST_PENDING, node);
    } else if (!node.passed) {
      this.stats.failures += 1;
      this.emit(EVENT_TEST_FAIL, node, node.err);
    } else {
      this.stats.passes += 1;
      this.emit(EVENT_TEST_PASS, node);
    }
    this.emit(EVENT_TEST_END, node);
  }

  #closeSuite(node) {
    this.stats.suites += 1;
    this.#openSuite(node);
    this.emit(EVENT_SUITE_END, node);
  }

  #completeNode(event, passed) {
    const node = this.#ensureNode(event);
    this.#ensureOpenAncestors(event.data.nesting);
    node.applyTestEvent(event, passed);

    if (event.data.details?.type === 'suite' || node.children.length > 0) {
      this.#closeSuite(node);
    } else {
      this.#reportTest(node);
    }

    this.#activeNodes[event.data.nesting] = undefined;
    this.#trimActiveNodes();
  }

  onTestStart(event) {
    this.#startRootSuite();
    this.#ensureOpenAncestors(event.data.nesting);
    this.#ensureNode(event);
  }

  onTestComplete(event, passed) {
    this.#startRootSuite();
    this.#completeNode(event, passed);
  }

  #closeActiveSuites() {
    for (let i = this.#activeNodes.length - 1; i >= 0; i -= 1) {
      const node = this.#activeNodes[i];
      if (node && node.isSuite) {
        this.#closeSuite(node);
        this.#activeNodes[i] = undefined;
      }
    }
    this.#trimActiveNodes();
  }
}

module.exports = async function mochaReporter(source) {
  const runner = new Runner();
  await runner.init();

  for await (const event of source) {
    switch (event.type) {
      case 'test:start':
        runner.onTestStart(event);
        break;
      case 'test:pass':
      case 'test:fail': {
        runner.onTestComplete(event, event.type === 'test:pass');
        break;
      }
      default:
        break;
    }
  }

  runner.end();
};
