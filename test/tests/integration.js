/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });
global.Promise = Promise;

const pg = require('pg');
const pgkeen = require('../../index');
const pgkeenLib = require('../../lib');
const assert = require('assert');
const path = require('path');

const sqlFiles = pgkeen.makeSqlLoader(path.join(__dirname, 'sql'));

async function handleQuery(pgClient, args) {
  return pgkeenLib.query(pgClient, pgkeenLib.namedParamsToBindVars(...args));
}

suite('Integration', () => {
  let pool;

  function createTestTable() {
    return pool.query('CREATE TABLE foo (val int);');
  }

  function dropTestTable() {
    return pool.query('DROP TABLE IF EXISTS foo;');
  }

  setup(async () => {
    if (pool) {
      pool.drain();
    }
    pool = pgkeen.makePool({
      makeClient: () => pgkeen.makeClient({ pg, handleQuery }),
      maxClients: 3,
    });
    await dropTestTable();
    await createTestTable();
  });

  test('Use a sql file', async () => {
    await pool.query('INSERT INTO foo VALUES(:val)', { val: 1 });
    const result = await pool.queryOne(await sqlFiles.get('count_foo.sql'), {
      val: 1,
    });
    assert.equal(result.count, 1);
  });
});
