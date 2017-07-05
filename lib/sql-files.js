const path = require('path');
const Promise = require('bluebird');
const fs = require('fs');

function init(rootDir) {
  const cache = [];

  function get(relPath) {
    if (!cache[relPath]) {
      const fullpath = path.join(rootDir, relPath);
      cache[relPath] = Promise.promisify(fs.readFile)(fullpath, 'utf8');
    }
    return cache[relPath];
  }

  return { get };
}

module.exports = init;
