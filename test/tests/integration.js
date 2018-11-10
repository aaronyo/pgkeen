/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });
global.Promise = Promise;

const fp = require('lodash/fp');
const pg = require('pg');
const keen = require('../../index');
const assert = require('assert');

async function query(sql, values, pgClient, opts) {
  return pgClient.query({
    text: sql,
    values,
    ...fp.omit(['text', 'values'], opts),
  });
}

const func = sql => (...args) => query(sql, fp.initial(args), fp.last(args));

async function namedParamsQuery(sql, namedParams, pgClient, opts) {
  const { text, values } = keen.namedParamsToBindVars(sql, namedParams);
  return pgClient.query({ text, values, ...fp.omit(['text', 'values'], opts) });
}

const namedParamsFunc = sql => (opts, pgClient) =>
  namedParamsQuery(sql, opts, pgClient);

function doInsert(val, pgClient) {
  return pgClient.query('INSERT INTO foo VALUES($1)', [val]);
}

const doInsert2 = func('INSERT INTO foo VALUES ($1), ($2)');

// function doInsert2a(val1, val2, pgClient) {
//   pgClient.query('INSERT INTO foo VALUES ($1), ($2)', val1, val2);
// }

// function doInsert2b({ val1, val2 }, pgClient) {
//   keen.namedParamsQuery('INSERT INTO foo VALUES (:val1), (:val2)', { val1, val2 }, pgClient);
// }

// const doInsert2c = namedParamsFunc('INSERT INTO foo VALUES (:val1), (:val2)');

// const doInsert2d = namedParamsFunc(
//   keen.readFileSync(__dirname, 'sql', 'count_foo.sql'),
// );

const doCount = keen.returnsScalar(
  namedParamsFunc(keen.readFileSync(__dirname, 'sql', 'count_foo.sql')),
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
    const bound = keen.bindAllToPool(pool, { doInsert2, doSelect });
    await bound.doInsert2(1, 1);
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
