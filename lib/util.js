const parseUrl = require('pg-connection-string').parse;
const fp = require('lodash/fp');
const fs = require('fs');
const path = require('path');

function camelizeColumns(rows) {
  return fp.map(fp.mapKeys(fp.camelCase), rows);
}

function parseConnectionUrl(url) {
  return parseUrl(url);
}

function readFileSync(...args) {
  return fs.readFileSync(path.join(...args), 'utf8');
}

module.exports = { camelizeColumns, parseConnectionUrl, readFileSync };
