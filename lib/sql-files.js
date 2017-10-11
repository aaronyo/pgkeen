const path = require('path');
const config = require('./config');
const fs = require('fs');

function init(rootDir) {
  const cache = [];

  function get(relPath) {
    if (!cache[relPath]) {
      const fullpath = path.join(rootDir, relPath);
      cache[relPath] = config.getPromise().promisify(fs.readFile)(
        fullpath,
        'utf8',
      );
    }
    return cache[relPath];
  }

  return { get };
}

module.exports = init;
