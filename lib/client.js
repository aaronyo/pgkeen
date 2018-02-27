const assert = require('assert');
const fp = require('lodash/fp');

function query({ pgClient }, ...args) {
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

async function disconnect({ pgClient }) {
  return pgClient.end();
}

async function queryRows({ client }, ...args) {
  return client.query(...args).then(result => result.rows);
}

async function queryOne({ client }, ...args) {
  const rows = await client.queryRows(...args);
  assert(rows.length < 2, 'Expected 0 or 1 row');
  return rows[0];
}

async function transaction({ client }, fn) {
  client.query('BEGIN');

  const onResult = fn(client);
  assert(
    fp.isFunction(onResult.then),
    'Transaction function must return a promise',
  );
  return onResult
    .then(result => {
      return client.query('END').then(() => result);
    })
    .then(fp.identity, err => {
      return client.query('ROLLBACK').then(
        () => {
          throw err;
        },
        rollbackErr => {
          throw rollbackErr;
        },
      );
    });
}

module.exports = { query, queryRows, queryOne, disconnect, transaction };
