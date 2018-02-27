const { makeComponent } = require('./helpers');
const { sqlLoader: sqlLoaderMethods } = require('../lib');

function makeSqlLoader(rootDir) {
  const cache = [];

  return makeComponent({
    name: 'sqlLoader',
    state: { cache, rootDir },
    methods: sqlLoaderMethods,
  });
}

module.exports = makeSqlLoader;
