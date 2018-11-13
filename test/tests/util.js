/* global suite: false, test: false, */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const fp = require('lodash/fp');
const keen = require('../../index');
const pg = require('pg');
const assert = require('assert');

const synchronized = require('../../lib/synchronized');

const URL = 'postgres://localhost:5432/postgres';

suite('Util', () => {
  test('Synchronized', async () => {
    const pool = keen.makePool(pg.Client, { url: URL }, { max: 10 });
    const completionMarkers = [];
    const returns = await Promise.all([
      keen.withClient(
        pool,
        fp.partialRight(synchronized, [
          'lockA',
          async () => {
            await Promise.delay(200);
            completionMarkers.push('a');
            return 'a';
          },
        ]),
      ),
      // There's no guarantee as to which statement would obtain 'lockA'
      // first, so we stick a delay here to make it much more likely that
      // the first statement will.
      Promise.delay(10).then(() => {
        return keen.withClient(
          pool,
          fp.partialRight(synchronized, [
            'lockA',
            () => {
              completionMarkers.push("a'");
              return Promise.resolve("a'");
            },
          ]),
        );
      }),
      keen.withClient(
        pool,
        fp.partialRight(synchronized, [
          'lockB',
          () => {
            completionMarkers.push('b');
            return Promise.resolve('b');
          },
        ]),
      ),
    ]);

    assert.deepEqual(returns, ['a', "a'", 'b']);
    assert.deepEqual(completionMarkers, ['b', 'a', "a'"]);
  });
});
