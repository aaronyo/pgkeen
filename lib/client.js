const assert = require('assert');
const fp = require('lodash/fp');

function query(pgClient, args) {
  return new global.Promise((resolve, reject) => {
    pgClient.query(...args, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

async function transaction(pgClient, client, fn) {
  pgClient.query('BEGIN');

  const onResult = fn(client);
  assert(
    fp.isFunction(onResult.then),
    'Transaction function must return a promise',
  );
  return onResult
    .then(result => {
      return pgClient.query('END').then(() => result);
    })
    .then(fp.identity, err => {
      return pgClient.query('ROLLBACK').finally(() => {
        throw err;
      });
    });
}

module.exports = { query, transaction };
