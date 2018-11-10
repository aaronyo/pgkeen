const parseUrl = require('pg-connection-string').parse;
const fp = require('lodash/fp');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function camelizeColumns(rows) {
  return fp.map(fp.mapKeys(fp.camelCase), rows);
}

function parseConnectionUrl(url) {
  return parseUrl(url);
}

function readFileSync(...args) {
  return fs.readFileSync(path.join(...args), 'utf8');
}

async function runQuery(
  SQL,
  Client,
  url = 'postgres://localhost:5432/postgres',
) {
  const pgClient = new Client(parseConnectionUrl(url));
  pgClient.connect();
  const result = await pgClient.query(SQL);
  pgClient.end();
  return result;
}

function query(pgClient, text, values, opts) {
  assert(
    !fp.has('text', opts),
    'text should only passed as an argument, not as a member of opts',
  );
  assert(
    !fp.has('values', opts),
    'values should only passed as an argument, not as a member of opts',
  );
  return pgClient.query({ text, values, ...opts });
}

function func(queryFn, sql, conversion, opts) {
  return async (pgClient, ...args) =>
    conversion(await queryFn(pgClient, sql, args, opts));
}

module.exports = {
  camelizeColumns,
  parseConnectionUrl,
  readFileSync,
  runQuery,
  query,
  func,
};
