const assert = require('assert');
const EventEmitter = require('events').EventEmitter();

const fp = require('lodash/fp');
const Promise = require('bluebird');
const parseUrl = require('pg-connection-string').parseUrl;
const Pool = require('pg').Pool;

// Features:
// 1) Simpler pool semantics
// 2) Simpler transaction semantics
// 3) psql like named parameters
// 4) query(), queryFirst, queryRaw()
// 5) Event hook for logging

function makePool(hostConfig, poolConfig) {
  const pgPool = Promise.promisifyAll(new Pool(
    fp.extend(hostConfig, poolConfig)
  ));

  function useConnection(fn) {
    return pgPool.connectAsync().spread((pgConn, release) => {
      return Promise.try(fn, pgConn).finally(release);
    });
  }

  function close() {
    return pgPool.endAsync();
  }

  return { useConnection, close };
}

function doCamelizeColumns(rows) {
  const keys = fp.map(fp.camelCase, fp.keys(rows[0]));
  return fp.reduce(
    (result, row) => {
      fp.times(
        i => {
          result[keys[i]] = row[i];
        },
        keys.length
      );
      return result;
    },
    {},
    rows
  );
}

function formatRows(camelizeColumns, rows) {
  return camelizeColumns ? doCamelizeColumns(rows) : rows;
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

  queryRaw(sql, ...vals) {
    this.emitter.emit('query', sql, vals);
    return new Promise((resolve, reject) => {
      this.pgConn.query(sql, vals, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    }).tap(result => {
      this.emitter.emit('queryResult', sql, vals, result);
    });
  }

  query(...args) {
    return this.queryRaw(...args).then(results => {
      return results && results.length
        ? formatRows(this.camelizeColumns, results)
        : null;
    });
  }

  queryFirst(...args) {
    return this.query(...args).then(fp.first);
  }

  // Returns a promise for work completed within the
  // scope of a single transaction.
  //
  // You supply a function which receives a connection and
  // returns a promise.
  //
  // The transaction has already been opened on the connection,
  // and it will automatically be committed once your promise
  // completes.
  //
  // NOTE: You should only use this function if you require
  // multiple statements to be executed within a single transaction.
  // Generally try to avoid this.  You must understand locking
  // (and deadlocking) in postgres before using this.
  transaction(fn) {
    this.query('BEGIN');

    return Promise.try(() => {
      const onResult = fn(this);
      assert(
        fp.isFunction(onResult.then),
        'Transaction function must return a promise'
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
      url = 'postgres://localhost:5432',
      host = null,
      pool = { max: 1 },
      camelizeColumns = false,
      eventListeners = {}
    } = {}
  ) {
    host = host || parseUrl(url);
    this.pool = makePool(host, pool);
    this.camelizeColumns = camelizeColumns;
    this.emitter = new EventEmitter();
    fp.each(
      ([eventName, listener]) => {
        this.emitter.on(eventName, listener);
      },
      fp.pairs(eventListeners)
    );
  }

  useConnection(fn) {
    return this.pool.useConnection(pgConn => {
      return Promise.try(() => {
        const onResult = fn(new Connection(
          pgConn,
          this.camelizeColumns,
          this.emitter
        ));
        // I can't think of a reason that a function of connection would
        // not want to return a promise, because a connection should not
        // be released until it's work is completed, so adding this safety
        // belt.
        assert(
          fp.isFunction(onResult.then),
          'Function of connection must return a promise'
        );
        return onResult;
      });
    });
  }

  // Connection methods are just passed through to the corresponding
  // connection method
  queryRaw(...args) {
    return this.useConnection(conn => conn.queryRaw(...args));
  }

  query(...args) {
    return this.useConnection(conn => conn.query(...args));
  }

  queryFirst(...args) {
    return this.useConnection(conn => conn.queryFirst(...args));
  }

  transaction(...args) {
    return this.useConnection(conn => conn.transaction(...args));
  }

  close() {
    return this.pool.close();
  }
}

module.exports = { Client };
