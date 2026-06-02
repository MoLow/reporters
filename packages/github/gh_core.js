import { EOL } from 'node:os';

function toCommandValue(input) {
  if (input === null || input === undefined) {
    return '';
  }
  if (typeof input === 'string' || input instanceof String) {
    return input;
  }
  return JSON.stringify(input);
}

export function toCommandProperties(annotationProperties) {
  /* c8 ignore start */ // callers always pass at least one property
  if (!Object.keys(annotationProperties).length) {
    return {};
  }
  /* c8 ignore stop */
  return {
    title: annotationProperties.title,
    file: annotationProperties.file,
    line: annotationProperties.startLine,
    endLine: annotationProperties.endLine,
    col: annotationProperties.startColumn,
    endColumn: annotationProperties.endColumn,
  };
}

function escapeData(s) {
  return toCommandValue(s)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
  return toCommandValue(s)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

const CMD_STRING = '::';
export class Command {
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
