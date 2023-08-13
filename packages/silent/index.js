'use strict';

// eslint-disable-next-line require-yield
module.exports = async function* silent(source) {
  // eslint-disable-next-line no-unused-vars
  for await (const event of source);
};
