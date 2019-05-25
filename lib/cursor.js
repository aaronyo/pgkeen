const fp = require('lodash/fp');
const assert = require('assert');
const Cursor = require('pg-cursor');

function queryCursor(conn, sql, values, opts) {
  assert(
    !fp.has('text', opts),
    'text should only passed as an argument, not as a member of opts',
  );
  assert(
    !fp.has('values', opts),
    'values should only passed as an argument, not as a member of opts',
  );
  return conn.query(new Cursor(sql, values, opts));
}

function readCursor(count, cursor) {
  return new Promise((resolve, reject) =>
    cursor.read(count, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    }),
  );
}

async function* iterCursor(batchSize, cursor) {
  while (true) {
    const rows = await readCursor(batchSize, cursor);
    if (!rows.length) break;
    yield rows;
  }
}

async function* queryIter(conn, batchSize, ...args) {
  const iterBatches = fp.partial(iterCursor, [batchSize]);
  return yield* fp.compose(
    iterBatches,
    queryCursor,
  )(conn, ...args);
}

module.exports = {
  queryCursor,
  readCursor,
  iterCursor,
  queryIter,
};
