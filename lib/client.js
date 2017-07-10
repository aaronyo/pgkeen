const assert = require('assert');
const EventEmitter = require('events').EventEmitter;

const fp = require('lodash/fp');
const Promise = require('bluebird');
const parseUrl = require('pg-connection-string').parse;
const Pool = require('pg').Pool;
const { parameterize } = require('./parameterize');

function makePool(hostConfig, poolConfig) {
  const pgPool = new Pool(fp.extend(hostConfig, poolConfig));

  function connection(fn) {
    return Promise.resolve(
      pgPool.connect().then(conn => {
        return Promise.try(fn, conn).finally(conn.release);
      }),
    );
  }

  function close() {
    return Promise.resolve(pgPool.end());
  }

  return { connection, close };
}

function doCamelizeColumns(rows) {
  return fp.map(fp.mapKeys(fp.camelCase), rows);
}

function formatRows(camelizeColumns, rows) {
  return camelizeColumns ? doCamelizeColumns(rows) : rows;
}

function usesNamedParams(args) {
  return fp.isObject(args[1]) && !fp.isArray(args[1]);
}

class Connection {
  constructor(pgConnection, camelizeColumns, emitter) {
    this.pgConn = pgConnection;
    this.camelizeColumns = camelizeColumns;
    this.emitter = emitter;
  }

  pgConnection() {
    return this.pgConn();
  }

  queryRaw(...args) {
    this.emitter.emit('query', args);
    if (usesNamedParams(args)) {
      args = [parameterize(...args)];
    }
    return new Promise((resolve, reject) => {
      this.pgConn.query(...args, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    }).tap(result => {
      this.emitter.emit('result', args, result);
    });
  }

  query(...args) {
    return this.queryRaw(...args).then(results => {
      return results.rows.length
        ? formatRows(this.camelizeColumns, results.rows)
        : [];
    });
  }

  queryOne(...args) {
    return this.query(...args).then(rows => {
      if (!rows.length) return null;
      assert(rows.length === 1, 'Expected 0 or 1 row');
      return rows[0];
    });
  }

  transaction(fn) {
    this.query('BEGIN');

    return Promise.try(() => {
      const onResult = fn(this);
      assert(
        fp.isFunction(onResult.then),
        'Transaction function must return a promise',
      );
      return onResult.then(result => {
        return this.query('END').then(() => result);
      });
    }).then(fp.identity, err => {
      return this.query('ROLLBACK').finally(() => {
        throw err;
      });
    });
  }
}

class Client {
  constructor(
    {
      url = 'postgres://localhost:5432/postgres',
      host = null,
      pool = { max: 1 },
      camelizeColumns = false,
      eventListeners = {},
    } = {},
  ) {
    host = host || parseUrl(url);
    this.pool = makePool(host, pool);
    this.camelizeColumns = camelizeColumns;
    this.emitter = new EventEmitter();
    fp.each(([eventName, listener]) => {
      this.emitter.on(eventName, listener);
    }, fp.toPairs(eventListeners));
  }

  connection(fn) {
    return this.pool.connection(pgConn => {
      return Promise.try(() => {
        const onResult = fn(
          new Connection(pgConn, this.camelizeColumns, this.emitter),
        );
        assert(
          fp.isFunction(onResult.then),
          'Function of connection must return a promise',
        );
        return onResult;
      });
    });
  }

  // Connection methods are just passed through to the corresponding
  // connection method
  close() {
    return this.pool.close();
  }
}

fp.each(
  method => {
    // eslint-disable-next-line func-names
    Client.prototype[method] = function(...args) {
      return this.connection(conn => conn[method](...args));
    };
  },
  ['queryRaw', 'query', 'queryOne', 'transaction'],
);

module.exports = Client;
