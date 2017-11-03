/* global suite: false, test: false, */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const pgkeen = require('../../index');
const assert = require('assert');

const { Client, synchronized } = pgkeen;

suite('Util', () => {
  test('Synchronized', async () => {
    const dbClient = new Client({ pool: { max: 3 } });
    const completionMarkers = [];
    await Promise.all([
      synchronized(dbClient, 'lockA', async () => {
        await Promise.delay(50);
        completionMarkers.push(2);
      }),
      synchronized(dbClient, 'lockA', () => {
        completionMarkers.push(3);
        return Promise.resolve();
      }),
      synchronized(dbClient, 'lockB', () => {
        completionMarkers.push(1);
        return Promise.resolve();
      }),
    ]);

    assert.deepEqual(completionMarkers, [1, 2, 3]);
  });
});
