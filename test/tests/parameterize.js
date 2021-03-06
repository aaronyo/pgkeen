/* global suite: false, test: false, */
const Promise = require('bluebird');
const fp = require('lodash/fp');

Promise.config({ longStackTraces: true });

const { extractNamedParams, parameterized } = require('../../lib/parameterize');
const assert = require('assert');

suite('Parameterized queries', () => {
  test('Extract params', async () => {
    assert.deepEqual(
      fp.pick(
        ['text', 'names'],
        extractNamedParams('SELECT 1 FROM foo WHERE val = :val'),
      ),
      {
        text: 'SELECT 1 FROM foo WHERE val = $1',
        names: ['val'],
      },
    );
  });

  test('Replace params', async () => {
    assert.deepEqual(
      parameterized('SELECT 1 FROM foo WHERE val = :val', { val: 1 }),
      ['SELECT 1 FROM foo WHERE val = $1', [1]],
    );
  });

  test('Replace multiple params', async () => {
    assert.deepEqual(
      parameterized(
        'SELECT 1 FROM foo WHERE a = :a AND b = :b AND :a IS NOT NULL',
        { a: 1, b: 2 },
      ),
      ['SELECT 1 FROM foo WHERE a = $1 AND b = $2 AND $1 IS NOT NULL', [1, 2]],
    );
  });

  test('Ignore comments', async () => {
    assert.deepEqual(
      parameterized('SELECT 1 FROM foo WHERE a = :a -- WHERE b = :a', {
        a: 1,
      }),
      ['SELECT 1 FROM foo WHERE a = $1 -- WHERE b = :a', [1]],
    );
  });

  test('Ignore casts', async () => {
    assert.deepEqual(
      parameterized('SELECT 1 FROM foo WHERE date = :date::date', {
        date: 1,
      }),
      ['SELECT 1 FROM foo WHERE date = $1::date', [1]],
    );
  });

  test('Replace nested params', async () => {
    assert.deepEqual(
      parameterized('SELECT 1 FROM foo WHERE val = :obj.val', {
        obj: { val: 1 },
      }),
      ['SELECT 1 FROM foo WHERE val = $1', [1]],
    );
  });

  test('Double digit params', async () => {
    assert.deepEqual(
      parameterized(
        'SELECT 1 FROM foo WHERE val =' +
          'ANY(:a, :b, :c, :d, :e, :f, :g, :h, :i, :j, :k)',
        { a: 0, b: 0, c: 1, d: 1, e: 2, f: 2, g: 3, h: 3, i: 4, j: 4, k: 5 },
      ),
      [
        'SELECT 1 FROM foo WHERE val =' +
          'ANY($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
      ],
    );
  });

  test('Param as prefix for another parm', async () => {
    assert.deepEqual(
      parameterized(
        'SELECT 1 FROM foo WHERE val = ANY(:foo, :bar, :fooBaz, :barBaz)',
        { foo: 1, bar: 2, fooBaz: 3, barBaz: 4 },
      ),
      ['SELECT 1 FROM foo WHERE val = ANY($1, $2, $3, $4)', [1, 2, 3, 4]],
    );
  });

  test('Param as path for another parm', async () => {
    assert.deepEqual(
      parameterized(
        'SELECT 1 FROM foo WHERE val = ANY(:foo, :bar, :foo.baz, :bar.baz)',
        { foo: { baz: 1 }, bar: { baz: 2 } },
      ),
      [
        'SELECT 1 FROM foo WHERE val = ANY($1, $2, $3, $4)',
        [{ baz: 1 }, { baz: 2 }, 1, 2],
      ],
    );
  });
});
