/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const pgkeen = require('../../index');
const assert = require('assert');
const path = require('path');

const sqlFiles = pgkeen.sqlFiles(path.join(__dirname, 'sql'));

suite('Integration', () => {
  let client;

  async function createTestTable() {
    await client.connection(async conn => {
      await conn.query('CREATE TABLE foo (val int);');
    });
  }

  async function dropTestTable() {
    await client.connection(async conn => {
      await conn.query('DROP TABLE IF EXISTS foo;');
    });
  }

  setup(async () => {
    if (client) {
      client.close();
    }
    client = new pgkeen.Client({ pool: { max: 1 } });
    await dropTestTable();
    await createTestTable();
  });

  test('Use a sql file', async () => {
    await client.query('INSERT INTO foo VALUES(:val)', { val: 1 });
    const result = await client.queryFirst(
      await sqlFiles.get('count_foo.sql'),
      {
        val: 1,
      },
    );
    assert.equal(result.count, 1);
  });
});
