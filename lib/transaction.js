const assert = require('assert');
const fp = require('lodash/fp');

async function transaction(pgClient, fn) {
  pgClient.query('BEGIN');

  const onResult = fn(pgClient);
  assert(
    fp.isFunction(onResult.then),
    'Transaction function must return a promise',
  );
  return onResult
    .then(result => {
      return pgClient.query('END').then(() => result);
    })
    .then(fp.identity, err => {
      return pgClient.query('ROLLBACK').then(
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
