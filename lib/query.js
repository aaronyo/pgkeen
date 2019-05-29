const fp = require('lodash/fp');
const assert = require('assert');
const { withConnection } = require('./pool');
const { parameterized } = require('./parameterize');

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

function queryFunc(sql, conversion = fp.identity, opts) {
  return async (conn, ...args) => {
    return conversion(await query(conn, sql, args, opts));
  };
}

function namedParamsQueryFunc(sql, conversion = fp.identity, opts) {
  return async (conn, params) => {
    return conversion(await query(conn, ...parameterized(sql, params), opts));
  };
}

module.exports = { query, poolQuery, queryFunc, namedParamsQueryFunc };
