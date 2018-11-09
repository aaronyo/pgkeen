/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });
global.Promise = Promise;

const fp = require('lodash/fp');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const keen = require('../../index');
const assert = require('assert');

async function query(sql, args, pgClient) {
  return pgClient.query(...keen.toBindVars(sql, args));
}

const func = sql => (...args) => query(sql, fp.initial(args), fp.last(args));
const namesFunc = sql => (opts, pgClient) => query(sql, opts, pgClient);

const doInsert = keen.returnsScalar(func('INSERT INTO foo VALUES($1)'));

const doCount = keen.returnsScalar(
  namesFunc(
    fs.readFileSync(path.join(__dirname, 'sql', 'count_foo.sql'), 'utf8'),
    {
      val: 1,
    },
  ),
);

// bad return type
async function doSelect(val, pgClient) {
  return keen.asScalar(
    await pgClient.query('SELECT * FROM foo WHERE val = $1', [val]),
  );
}

suite('Integration', () => {
  let pool;

  function createTestTable() {
    return keen.withClient(pool, pgClient =>
      pgClient.query('CREATE TABLE foo (val int);'),
    );
  }

  function dropTestTable() {
    return keen.withClient(pool, pgClient =>
      pgClient.query('DROP TABLE IF EXISTS foo;'),
    );
  }

  setup(async () => {
    if (pool) {
      pool.drain();
    }
    pool = keen.makePool({
      pgClientClass: pg.Client,
      max: 3,
    });
    await dropTestTable();
    await createTestTable();
  });

  test('Use a sql file', async () => {
    const bound = keen.bindAllToPool(pool, { doInsert, doCount });
    await bound.doInsert(1);
    const result = await bound.doCount({ val: 1 });
    assert.equal(result, 1);
  });

  test('Throws error on bad return type', async () => {
    const bound = keen.bindAllToPool(pool, { doInsert, doSelect });
    await bound.doInsert(1);
    await bound.doInsert(1);
    let failed = false;
    try {
      await bound.doSelect(1);
      throw new Error('should have failed');
    } catch (e) {
      failed = true;
    }
    assert(failed);
  });
});
