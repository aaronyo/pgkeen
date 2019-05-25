/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });
global.Promise = Promise;

const fp = require('lodash/fp');
const pg = require('pg');
const keen = require('../../index');
const assert = require('assert');

const queryFunc = fp.partial(keen.queryFunc, [keen.query]);
const namedParamsQueryFunc = fp.partial(keen.namedParamsQueryFunc, [
  keen.query,
]);

const URL = 'postgres://localhost:5432/postgres';

suite('Integration', () => {
  function createTestTable() {
    return keen.run(pg.Client, 'CREATE TABLE foo (val int);', URL);
  }

  function dropTestTable() {
    return keen.run(pg.Client, 'DROP TABLE IF EXISTS foo', URL);
  }

  setup(async () => {
    await dropTestTable();
    await createTestTable();
  });

  test('Use various query functions thar are bound to a pool', async () => {
    // Create functions that perform db queries. We can build these functions
    // in a veriety of ways, but note that they all expect a queryable
    // as their first argument.
    async function insert(queryable, val) {
      await queryable.query('INSERT INTO foo VALUES($1)', [val]);
    }

    const values = queryFunc('SELECT * from foo', keen.asScalars);

    const count = namedParamsQueryFunc(
      await keen.readFileSync(__dirname, 'sql', 'count_foo.sql'),
      keen.asScalar,
    );

    async function badConversion(queryable) {
      return keen.asScalar(await queryable.query('SELECT * from FOO'));
    }

    // Make a pool of node pg clients
    const pool = keen.makePool(pg.Client, { url: URL });

    // Create versions of the functions that will automatically be called
    // against a client from the pool
    const bound = fp.mapValues(keen.bindToPool(pool), {
      insert,
      count,
      values,
      badConversion,
    });

    // Now we can use the bound functions
    await bound.insert(1);
    await bound.insert(1);
    assert.equal(await bound.count({ val: 1 }), 2);
    assert.deepEqual(await bound.values(), [1, 1]);

    let conversionFailed = false;
    try {
      await bound.badConversion(1);
      throw new Error('should have failed');
    } catch (err) {
      assert(fp.startsWith('Expected 0 or 1 row', err.message));
      conversionFailed = true;
    }
    assert(conversionFailed);

    let insideValues;
    try {
      await keen.poolTransaction(pool, async conn => {
        await insert(conn, 1);
        insideValues = await values(conn);
        throw new Error();
      });
    } catch (err) {
      assert(true);
    }
    assert.deepEqual(insideValues, [1, 1, 1]);
    assert.deepEqual(await bound.values(), [1, 1]);
  });
});
