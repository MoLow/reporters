'use strict';

const [major, minor] = process.versions.node.split('.').map(Number);

module.exports = {
  isSupported: major > 20 || (major === 20 && minor >= 3) || (major === 18 && minor >= 17),
};
