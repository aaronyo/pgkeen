const parseUrl = require('pg-connection-string').parse;
const fp = require('lodash/fp');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { namedParamsToBindVars } = require('./parameterize');

function camelizeColumns(rows) {
  return fp.map(fp.mapKeys(fp.camelCase), rows);
}

function parseConnectionUrl(url) {
  return parseUrl(url);
}

function readFileSync(...args) {
  return fs.readFileSync(path.join(...args), 'utf8');
}

async function run(Client, SQL, url = 'postgres://localhost:5432/postgres') {
  const pgClient = new Client(parseConnectionUrl(url));
  pgClient.connect();
  const result = await pgClient.query(SQL);
  pgClient.end();
  return result;
}

function query(queryable, sql, values, opts) {
  assert(
    !fp.has('text', opts),
    'text should only passed as an argument, not as a member of opts',
  );
  assert(
    !fp.has('values', opts),
    'values should only passed as an argument, not as a member of opts',
  );
  return queryable.query({ text: sql, values, ...opts });
}

function queryFunc(queryWrapperFn, sql, conversion, opts) {
  return async (queryable, ...args) =>
    conversion(await queryWrapperFn(queryable, sql, args, opts));
}

function namedParamsQueryFunc(queryWrapperFn, sql, conversion, opts) {
  return async (queryable, params) =>
    conversion(
      await queryWrapperFn(
        queryable,
        ...namedParamsToBindVars(sql, params),
        opts,
      ),
    );
}

module.exports = {
  camelizeColumns,
  parseConnectionUrl,
  readFileSync,
  run,
  query,
  queryFunc,
  namedParamsQueryFunc,
};
