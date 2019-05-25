const fp = require('lodash/fp');
const assert = require('assert');
const { withConnection } = require('./pool');

async function query(conn, sql, values, opts) {
  assert(
    !fp.has('text', opts),
    'text should only passed as an argument, not as a member of opts',
  );
  assert(
    !fp.has('values', opts),
    'values should only passed as an argument, not as a member of opts',
  );
  return await conn.query({ text: sql, values, ...opts });
}

function poolQuery(pool, ...args) {
  return withConnection(pool, conn => query(conn, ...args));
}

module.exports = { query, poolQuery };
