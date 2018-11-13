const assert = require('assert');
const fp = require('lodash/fp');

// http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
// An integer only hash of a string
/* eslint-disable no-bitwise */
/* eslint-disable no-mixed-operators */
function hashCode(str) {
  let hash = 0;
  let i;
  let chr;
  let len;
  if (str.length === 0) return hash;
  for (i = 0, len = str.length; i < len; i += 1) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}
/* eslint-enable no-bitwise */
/* eslint-enable no-mixed-operators */

async function synchronized(pgClient, lockName, workFn) {
  // Prevent mistake of passing in a generic queryable, which might not
  // guarantee the same client across queries
  assert(
    fp.has('end') && fp.has('connect'),
    'First argument to transaction must be a node-pg client',
  );
  const lockNum = hashCode(lockName);
  return pgClient
    .query('SELECT pg_advisory_lock(' + lockNum + ');')
    .then(() => {
      const result = workFn();
      if (!fp.isFunction(fp.get('then', result))) {
        throw new Error(
          'Synchronized functions should return a promise.' +
            ' The lock is normally released when the promise is resolved.' +
            ' Releasing immediately.',
        );
      }
      return result;
    })
    .then(
      result =>
        pgClient
          .query('SELECT pg_advisory_unlock(' + lockNum + ');')
          .then(() => result),
      err =>
        pgClient
          .query('SELECT pg_advisory_unlock(' + lockNum + ');')
          .then(() => {
            throw err;
          }),
    );
}

module.exports = synchronized;
