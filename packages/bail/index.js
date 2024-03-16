'use strict';

module.exports = async function* bail(source) {
  for await (const event of source) {
    if (event.type === 'test:fail') {
      /* c8 ignore start */
      yield `\n\u001b[31m✖ Bailing on failed test: ${event.data.name}\u001b[0m\n`;
      throw new Error('Bail');
    }
    /* c8 ignore stop */
  }
};
