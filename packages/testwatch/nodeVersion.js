const [major, minor] = process.versions.node.split('.').map(Number);

module.exports = {
  isSupported: major >= 20 && (major > 20 || minor >= 3),
};
