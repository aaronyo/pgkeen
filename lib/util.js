const parseUrl = require('pg-connection-string').parse;
const fp = require('lodash/fp');
const fs = require('fs');
const path = require('path');

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

module.exports = {
  camelizeColumns,
  parseUrl,
  readFileSync,
  run,
};
