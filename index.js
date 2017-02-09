const assert = require('assert');
const EventEmitter = require('events').EventEmitter;

const fp = require('lodash/fp');
const Promise = require('bluebird');
const parseUrl = require('pg-connection-string').parse;
const Pool = require('pg').Pool;

// Features:
// 1) Safer pool semantics
// 2) Safer transaction semantics
// 4) queryFirst()
// 5) Event hooks for logging
// 6) Optional column camelizing

function makePool(hostConfig, poolConfig) {
  const pgPool = new Pool(fp.extend(hostConfig, poolConfig));

  function connection(fn) {
    return Promise.resolve(
      pgPool.connect().then(conn => {
        return Promise.try(fn, conn).finally(conn.release);
      })
    );
  }

  function close() {
    return Promise.resolve(pgPool.end());
  }

  return { connection, close };
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

  queryRaw(sql, vals) {
    if (!fp.isString(sql)) {
      sql = sql.text;
      vals = sql.vals;
    }
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
      this.emitter.emit('result', sql, vals, result);
    });
  }

  query(...args) {
    return this.queryRaw(...args).then(results => {
      return results.rows.length
        ? formatRows(this.camelizeColumns, results.rows)
        : null;
    });
  }

  queryFirst(...args) {
    return this.query(...args).then(([row]) => row);
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
      url = 'postgres://localhost:5432/postgres',
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
      fp.toPairs(eventListeners)
    );
  }

  connection(fn) {
    return this.pool.connection(pgConn => {
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
    return this.connection(conn => conn.queryRaw(...args));
  }

  query(...args) {
    return this.connection(conn => conn.query(...args));
  }

  queryFirst(...args) {
    return this.connection(conn => conn.queryFirst(...args));
  }

  transaction(...args) {
    return this.connection(conn => conn.transaction(...args));
  }

  close() {
    return this.pool.close();
  }
}

module.exports = { Client };
