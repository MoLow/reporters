'use strict';

/* eslint-disable camelcase */
/* eslint-disable no-continue */
const ms = require('ms');

const GRAY = '\x1b[38;5;8m';
const CLEAR = '\x1b[0m';
const THRESHOLDS = [
  [250, CLEAR],
  [600, '\x1b[33m'],
  [900, '\x1b[38;5;215m'],
  [Infinity, '\x1b[31m'],
];

const COLORED_CWD = `${GRAY}${process.cwd()}${CLEAR}`;

module.exports = async function* slowTestsReporter(source) {
  const files = new Map();
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const {
      data: {
        details: { type, duration_ms }, name, file, column, line,
      },
    } = event;
    if (duration_ms < THRESHOLDS[0][0] || type === 'suite') continue;
    const slowTests = files.get(file) || [];
    slowTests.push({
      duration_ms, name, file, column, line,
    });
    files.set(file, slowTests);
  }

  for (const [file, slowTests] of files) {
    const colord_file = file.replace(process.cwd(), COLORED_CWD);
    yield `file: ${colord_file} has slow tests:\n`;
    slowTests.sort((a, b) => b.duration_ms - a.duration_ms);
    for (const {
      duration_ms, name, column, line,
    } of slowTests) {
      const [, color] = THRESHOLDS
        .find(([threshold]) => duration_ms < threshold) || THRESHOLDS[THRESHOLDS.length - 1];
      yield `  ${color}-${CLEAR} ${name} [${color}${ms(duration_ms)}${CLEAR}] (${CLEAR}${colord_file}:${line}:${column})\n`;
    }
  }
};
