const fp = require('lodash/fp');
const genericPool = require('generic-pool');
const util = require('./util');

function makePool(PGClient, opts = {}) {
  const { pgUrl = 'postgres://localhost:5432/postgres' } = opts;
  const clientFactory = {
    create() {
      const pgClient = new PGClient(util.parseConnectionUrl(pgUrl));
      pgClient.connect();
      return pgClient;
    },
    destroy(client) {
      client.end();
    },
  };

  return genericPool.createPool(clientFactory, fp.omit(['pgUrl'], opts));
}

// Convenience function to ensure:
// a) clients get released after use
// b) clients that throw an error get destroyed after use
function withClient(pool, fn) {
  return pool.acquire().then(client => {
    const onResult = fn(client);
    if (!fp.isFunction(fp.get('then', onResult))) {
      pool.release(client);
      throw new Error('Function must return a promise: ' + fn.toString());
    }
    return onResult.then(
      result => {
        pool.release(client);
        return result;
      },
      err => {
        pool.destroy(client);
        throw err;
      },
    );
  });
}

function bindToQueryable(pool, fn) {
  return (...args) =>
    fn(
      {
        query: (...queryArgs) =>
          withClient(pool, client => client.query(...queryArgs)),
      },
      ...args,
    );
}

function bindToClient(pool, fn) {
  return (...args) => withClient(pool, client => fn(client, ...args));
}

function drain(pool) {
  return pool.drain().then(() => {
    return pool.clear();
  });
}

module.exports = {
  makePool,
  withClient,
  bindToQueryable: fp.curry(bindToQueryable),
  bindToClient: fp.curry(bindToClient),
  drain,
};
