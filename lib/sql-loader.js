const path = require('path');
const fs = require('fs');

function get({ cache, rootDir }, relPath) {
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

module.exports = { get };
