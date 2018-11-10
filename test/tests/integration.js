/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });
global.Promise = Promise;

const fp = require('lodash/fp');
const pg = require('pg');
const keen = require('../../index');
const assert = require('assert');

const func = fp.partial(keen.func, [keen.query]);

suite('Integration', () => {
  function createTestTable() {
    return keen.runQuery('CREATE TABLE foo (val int);', pg.Client);
  }

  function dropTestTable() {
    return keen.runQuery('DROP TABLE IF EXISTS foo', pg.Client);
  }

  setup(async () => {
    await dropTestTable();
    await createTestTable();
  });

  test('Use a sql file', async () => {
    async function insert(pgClient, val) {
      await pgClient.query('INSERT INTO foo VALUES($1)', [val]);
    }

    const values = func('SELECT * from foo', keen.toScalars);

    async function count(pgClient, { val }) {
      return keen.toScalar(
        await pgClient.query(
          ...keen.toBindVars(
            keen.readFileSync(__dirname, 'sql', 'count_foo.sql'),
            { val },
          ),
        ),
      );
    }

    async function badConversion(pgClient) {
      return keen.toScalar(await pgClient.query('SELECT * from FOO'));
    }

    const pool = keen.makePool(pg.Client);
    const bound = keen.bindAllToPool(pool, {
      insert,
      count,
      values,
      badConversion,
    });
    await bound.insert(1);
    await bound.insert(1);
    assert.equal(await bound.count({ val: 1 }), 2);
    assert.deepEqual(await bound.values(), [1, 1]);

    let conversionFailed = false;
    try {
      await bound.badConversion(1);
      throw new Error('should have failed');
    } catch (e) {
      conversionFailed = true;
    }
    assert(conversionFailed);
  });
});
