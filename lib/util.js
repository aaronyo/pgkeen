const parseUrl = require('pg-connection-string').parse;
const fp = require('lodash/fp');

function camelizeColumns(rows) {
  return fp.map(fp.mapKeys(fp.camelCase), rows);
}

function parseConnectionUrl(url) {
  return parseUrl(url);
}

module.exports = { camelizeColumns, parseConnectionUrl };
