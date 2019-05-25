const parseUrl = require('pg-connection-string').parse;
const fp = require('lodash/fp');
const fs = require('fs');
const path = require('path');
const { parameterized } = require('./parameterize');

function camelizeColumns(rows) {
  return fp.map(fp.mapKeys(fp.camelCase), rows);
}

function readFileSync(...args) {
  return fs.readFileSync(path.join(...args), 'utf8');
}

async function run(Client, SQL, url) {
  const pgClient = new Client(url ? parseUrl(url) : {});
  pgClient.connect();
  const result = await pgClient.query(SQL);
  pgClient.end();
  return result;
}

function queryFunc(queryWrapperFn, sql, conversion = fp.identity, opts) {
  return async (queryable, ...args) =>
    conversion(await queryWrapperFn(queryable, sql, args, opts));
}

function namedParamsQueryFunc(
  queryWrapperFn,
  sql,
  conversion = fp.identity,
  opts,
) {
  return async (queryable, params) =>
    conversion(
      await queryWrapperFn(queryable, ...parameterized(sql, params), opts),
    );
}

module.exports = {
  camelizeColumns,
  parseUrl,
  readFileSync,
  run,
  queryFunc,
  namedParamsQueryFunc,
};
