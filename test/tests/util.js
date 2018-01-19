/* global suite: false, test: false, */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const pgkeen = require('../../index');
const assert = require('assert');

const { Client, synchronized } = pgkeen;

suite('Util', () => {
  test('Synchronized', async () => {
    const dbClient = new Client({ pool: { max: 10 } });
    const completionMarkers = [];
    await Promise.all([
      synchronized(dbClient, 'lockA', async () => {
        await Promise.delay(200);
        completionMarkers.push(2);
      }),
      // There's no guarantee as to which statement would obtain 'lockA'
      // first, so we stick a delay here to make it much more likely that
      // the first statement will.
      Promise.delay(10).then(() => {
        synchronized(dbClient, 'lockA', () => {
          completionMarkers.push(3);
          return Promise.resolve();
        });
      }),
      synchronized(dbClient, 'lockB', () => {
        completionMarkers.push(1);
        return Promise.resolve();
      }),
    ]);

    assert.deepEqual(completionMarkers, [1, 2, 3]);
  });
});
