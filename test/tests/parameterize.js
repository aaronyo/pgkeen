/* global suite: false, test: false, */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const fp = require('lodash/fp');
const { extractParams, parameterize } = require('../../lib/parameterize');
const assert = require('assert');

suite('SQL Strings', () => {
  test('Extract params', async () => {
    assert.deepEqual(extractParams('SELECT 1 FROM foo WHERE val = :val'), {
      text: 'SELECT 1 FROM foo WHERE val = $1',
      names: ['val'],
    });
  });

  test('Replace params', async () => {
    assert.deepEqual(
      parameterize('SELECT 1 FROM foo WHERE val = :val', { val: 1 }),
      {
        text: 'SELECT 1 FROM foo WHERE val = $1',
        values: [1],
      },
    );
  });

  test('Replace params, curried', async () => {
    const simpleQuery = parameterize('SELECT 1 FROM foo WHERE val = :val');
    assert(fp.isFunction(simpleQuery));

    assert.deepEqual(simpleQuery({ val: 1 }), {
      text: 'SELECT 1 FROM foo WHERE val = $1',
      values: [1],
    });
  });

  test('Replace multiple params', async () => {
    assert.deepEqual(
      parameterize(
        'SELECT 1 FROM foo WHERE a = :a AND b = :b AND :a IS NOT NULL',
        { a: 1, b: 2 },
      ),
      {
        text: 'SELECT 1 FROM foo WHERE a = $1 AND b = $2 AND $1 IS NOT NULL',
        values: [1, 2],
      },
    );
  });

  test('Ignore comments', async () => {
    assert.deepEqual(
      parameterize('SELECT 1 FROM foo WHERE a = :a -- WHERE b = :a', {
        a: 1,
      }),
      {
        text: 'SELECT 1 FROM foo WHERE a = $1 -- WHERE b = :a',
        values: [1],
      },
    );
  });

  test('Ignore casts', async () => {
    assert.deepEqual(
      parameterize('SELECT 1 FROM foo WHERE date = :date::date', {
        date: 1,
      }),
      {
        text: 'SELECT 1 FROM foo WHERE date = $1::date',
        values: [1],
      },
    );
  });
});
