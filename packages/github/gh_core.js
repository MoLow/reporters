'use strict';

// From Github Core SDK code
// eslint-disable-next-line import/no-unresolved
const coreUtils = require('@actions/core/lib/utils');
const { EOL } = require('node:os');

function escapeData(s) {
  return coreUtils.toCommandValue(s)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
  return coreUtils.toCommandValue(s)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

const CMD_STRING = '::';
class Command {
  constructor(command, properties, message, options = { EOL }) {
    this.command = command ?? 'missing.command';
    this.properties = properties;
    this.message = message;
    this.options = options;
  }

  toString() {
    let cmdStr = CMD_STRING + this.command;
    if (this.properties && Object.keys(this.properties).length > 0) {
      cmdStr += ' ';
      let first = true;
      // eslint-disable-next-line no-restricted-syntax
      for (const key in this.properties) {
        // eslint-disable-next-line no-prototype-builtins
        if (this.properties.hasOwnProperty(key)) {
          const val = this.properties[key];
          if (val) {
            if (first) {
              first = false;
            } else {
              cmdStr += ',';
            }
            cmdStr += `${key}=${escapeProperty(val)}`;
          }
        }
      }
    }
    cmdStr += `${CMD_STRING}${escapeData(this.message)}${this.options.EOL}`;
    return cmdStr;
  }
}

module.exports = {
  toCommandProperties: coreUtils.toCommandProperties,
  Command,
};
