const fp = require('lodash/fp');
const genericPool = require('generic-pool');
const util = require('./util');

function makePool(opts) {
  const {
    pgClientClass: Client,
    pgUrl = 'postgres://localhost:5432/postgres',
  } = opts;
  const clientFactory = {
    create() {
      const pgClient = new Client(util.parseConnectionUrl(pgUrl));
      pgClient.connect();
      return pgClient;
    },
    destroy(client) {
      client.end();
    },
  };

  return genericPool.createPool(clientFactory, opts);
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

function bindToPool(pool, fn) {
  return (...args) => withClient(pool, client => fn(...args, client));
}

function bindAllToPool(pool, fns) {
  return fp.mapValues(fn => bindToPool(pool, fn), fns);
}

function drain(pool) {
  return pool.drain().then(() => {
    return pool.clear();
  });
}

module.exports = {
  makePool,
  withClient,
  bindToPool,
  bindAllToPool,
  drain,
};
