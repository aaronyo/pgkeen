const assert = require('assert');
const fp = require('lodash/fp');

async function transaction(conn, fn) {
  conn.query('BEGIN');

  const onResult = fn(conn);
  assert(
    fp.isFunction(onResult.then),
    'Transaction function must return a promise',
  );
  return onResult
    .then(result => {
      return conn.query('END').then(() => result);
    })
    .then(fp.identity, err => {
      return conn.query('ROLLBACK').then(
        () => {
          throw err;
        },
        rollbackErr => {
          throw rollbackErr;
        },
      );
    });
}

module.exports = transaction;
