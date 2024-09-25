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
    this.#mochaOptions = mochaOptions;

    this.body = '';
    this._beforeAll = [];
    this._beforeEach = [];
    this._afterAll = [];
    this._afterEach = [];
  }

  applyTestEvent(event, passed) {
    this.title = event.data.name;
    this.file = event.data.file;
    this.pending = Boolean(event.data.skip || event.data.todo);
    this.duration = event.data.details?.duration_ms;
    const error = event.data.details?.error;
    this.err = error?.cause instanceof Error ? error.cause : error;
    this.passed = passed;
    this.nesting = event.data.nesting;
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

  finalize() {
    this.suites = this._suites;
    this.tests = this._tests;
  }

  get _suites() {
    return this.children.filter((child) => child.children.length > 0);
  }

  get _tests() {
    return this.children.filter((child) => child.children.length === 0);
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

  #root = new Test();

  #current = this.#root;

  #mochaOptions = loadOptions([]);

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
        console.error(err);
      }
    }
    if (!Reporter) {
      console.error(new Error(`invalid reporter "${reporterName}"`));
      return;
    }
    this.#reporter = new Reporter(this, this.#mochaOptions);
    this.emit(EVENT_RUN_BEGIN);
  }

  get suite() {
    return this.#current;
  }

  end() {
    if (!this.#reporter) {
      return;
    }
    this.stats.end = new Date();
    this.stats.duration = this.stats.end - this.stats.start;
    this.#report();
    this.emit(EVENT_RUN_END);
    if (typeof this.#reporter.done === 'function') {
      this.#reporter.done(this.stats.failures, () => {});
    }
  }

  #report(suite = this.#root) {
    /* Not like mocha,  node:test runs tests as soon as they are encountered
    so the exact structure is unknown until all suites end */
    this.emit(EVENT_SUITE_BEGIN, suite);
    suite.finalize();
    for (const s of suite.suites) {
      this.#report(s);
    }
    for (const test of suite.tests) {
      this.emit(EVENT_TEST_BEGIN, test);
      if (test.pending) {
        this.emit(EVENT_TEST_PENDING, test);
      } else if (!test.passed) {
        this.emit(EVENT_TEST_FAIL, test, test.err);
      } else {
        this.emit(EVENT_TEST_PASS, test);
      }
      this.emit(EVENT_TEST_END, test);
    }
    this.emit(EVENT_SUITE_END, suite);
  }

  addChild(event, passed) {
    const current = this.#current;
    this.#current = new Test(current);
    this.#current.applyTestEvent(event, passed);
    current.children.push(this.#current);
  }

  isNewTest(event) {
    return this.#current.title !== event.data.name || this.#current.nesting !== event.data.nesting;
  }

  childCompleted(event, passed) {
    this.#current.applyTestEvent(event, passed);
    if (this.#current?.nesting === event.data.nesting) {
      if (this.#current.children.length > 0) {
        this.stats.suites += 1;
      } else if (this.#current.pending) {
        this.stats.tests += 1;
        this.stats.pending += 1;
      } else if (!this.#current.passed) {
        this.stats.tests += 1;
        this.stats.failures += 1;
      } else {
        this.stats.tests += 1;
        this.stats.passes += 1;
      }
      this.#current = this.#current.parent;
    }
  }
}

module.exports = async function mochaReporter(source) {
  const runner = new Runner();
  await runner.init();

  for await (const event of source) {
    switch (event.type) {
      case 'test:start':
        runner.addChild(event, false);
        break;
      case 'test:pass':
      case 'test:fail': {
        if (runner.isNewTest(event)) {
          runner.addChild(event, event.type === 'test:pass');
        }
        runner.childCompleted(event, event.type === 'test:pass');
        break;
      }
      default:
        break;
    }
  }

  runner.end();
};
