const fp = require('lodash/fp');
const genericPool = require('generic-pool');
const util = require('./util');

function makePool(PGClient, clientOpts = {}, poolOpts = {}) {
  const connectionFactory = {
    create() {
      const conn = new PGClient({
        ...(clientOpts.url ? util.parseUrl(clientOpts.url) : {}),
        ...clientOpts,
      });
      conn.connect();
      return conn;
    },
    destroy(conn) {
      conn.end();
    },
  };

  return genericPool.createPool(
    connectionFactory,
    fp.omit(['pgUrl'], poolOpts),
  );
}

// Convenience function to ensure:
// a) connections get released after use
// b) connections that throw an error get destroyed after use
function withConnection(pool, fn) {
  return pool.acquire().then(conn => {
    const onResult = fn(conn);
    if (!fp.isFunction(fp.get('then', onResult))) {
      pool.release(conn);
      throw new Error('Function must return a promise: ' + fn.toString());
    }
    return onResult.then(
      result => {
        pool.release(conn);
        return result;
      },
      err => {
        pool.destroy(conn);
        throw err;
      },
    );
  });
}

function bindQueryable(pool, fn) {
  return (...args) =>
    fn(
      {
        query: (...queryArgs) =>
          withConnection(pool, conn => conn.query(...queryArgs)),
      },
      ...args,
    );
}

function bindConnection(pool, fn) {
  return (...args) => withConnection(pool, conn => fn(conn, ...args));
}

function drain(pool) {
  return pool.drain().then(() => {
    return pool.clear();
  });
}

module.exports = {
  makePool,
  withConnection,
  bindQueryable: fp.curry(bindQueryable),
  bindConnection: fp.curry(bindConnection),
  drain,
};
