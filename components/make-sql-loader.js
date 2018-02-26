const path = require('path');
const fs = require('fs');

function makeSqlLoader(rootDir) {
  const cache = [];

  function get(relPath) {
    if (!cache[relPath]) {
      const fullpath = path.join(rootDir, relPath);
      cache[relPath] = new global.Promise((resolve, reject) =>
        fs.readFile(fullpath, 'utf8', (err, text) => {
          if (err) reject(err);
          else resolve(text);
        }),
      );
    }
    return cache[relPath];
  }

  return { get };
}

module.exports = makeSqlLoader;
