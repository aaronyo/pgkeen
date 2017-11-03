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

function synchronized(dbClient, lockName, workFn) {
  const lockNum = hashCode(lockName);
  return dbClient.connection(conn =>
    conn
      .query('SELECT pg_advisory_lock(' + lockNum + ');')
      .then(() => {
        const result = workFn();
        if (!fp.isFunction(fp.get('then', result))) {
          throw new Error(
            'Synchronized functions must return a promise.' +
              ' The lock is not released until the promise is resolved.',
          );
        }
        return result;
      })
      .finally(() => conn.query('SELECT pg_advisory_unlock(' + lockNum + ');')),
  );
}

module.exports = { synchronized };
