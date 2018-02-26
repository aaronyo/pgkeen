/* global suite: false, test: false, */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const pg = require('pg');
const assert = require('assert');

const { makePool, makeClient } = require('../../index');
const { synchronized } = require('../../lib');

suite('Util', () => {
  test('Synchronized', async () => {
    const dbClient = makePool({
      makeClient: () => makeClient({ pg }),
      maxClients: 10,
    });
    const completionMarkers = [];
    const returns = await Promise.all([
      synchronized(dbClient, 'lockA', async () => {
        await Promise.delay(200);
        completionMarkers.push(2);
        return 'a';
      }),
      // There's no guarantee as to which statement would obtain 'lockA'
      // first, so we stick a delay here to make it much more likely that
      // the first statement will.
      Promise.delay(10).then(() => {
        return synchronized(dbClient, 'lockA', () => {
          completionMarkers.push(3);
          return Promise.resolve('a');
        });
      }),
      synchronized(dbClient, 'lockB', () => {
        completionMarkers.push(1);
        return Promise.resolve('b');
      }),
    ]);

    assert.deepEqual(returns, ['a', 'a', 'b']);
    assert.deepEqual(completionMarkers, [1, 2, 3]);
  });
});
