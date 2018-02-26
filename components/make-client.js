const pgkeenLib = require('../lib');
const assert = require('assert');

async function makeClient({
  pg,
  handleQuery = pgkeenLib.query,
  handleTransaction = pgkeenLib.transaction,
  url = 'postgres://localhost:5432/postgres',
}) {
  const pgClient = new pg.Client(pgkeenLib.parseConnectionUrl(url));
  pgClient.connect();

  const client = {
    query: (...args) => {
      return handleQuery(pgClient, args);
    },
    queryRows: (...args) => client.query(...args).then(result => result.rows),
    queryOne: async (...args) => {
      const rows = await client.queryRows(...args);
      assert(rows.length < 2, 'Expected 0 or 1 row');
      return rows[0];
    },
    transaction: fn => handleTransaction(pgClient, client, fn),
    disconnect: () => pgClient.end(),
  };

  return client;
}

module.exports = makeClient;
