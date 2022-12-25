const assert = require('assert');

function compareLines(output = '', expected = '') {
  const outputLines = output.split(/\r?\n/);
  const expectedLines = expected.split(/\r?\n/);
  if (outputLines.length !== expectedLines.length) {
    console.log(`Output: ${outputLines.length} lines`);
    console.log(output);
    console.log(`Expected: ${expectedLines.length} lines`);
    console.log(expected);
    assert.fail('Output and expected have different number of lines');
  }
  for (let i = 0; i < expectedLines.length; i += 1) {
    const expectedRegex = new RegExp(expectedLines[i]);
    assert.match(outputLines[i], expectedRegex, `Line ${i} did not match`);
  }
  return true;
}

module.exports = {
  compareLines,
};
