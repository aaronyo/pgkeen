const assert = require('assert');
const fp = require('lodash/fp');

function toRows(result) {
  return result.rows;
}

function toRow(result) {
  const rows = toRows(result);
  assert(rows.length < 2, 'Expected 0 or 1 row: ' + JSON.stringify(rows));
  return rows[0] || null;
}

function rowToScalar(row) {
  if (row === null) return null;
  const values = fp.values(row);
  assert(
    (values.length = 1),
    'Expected a single value: ' + JSON.stringify(values),
  );
  return values[0];
}

function toScalar(result) {
  return rowToScalar(toRow(result));
}

function toScalars(result) {
  return fp.map(rowToScalar, toRows(result));
}

module.exports = {
  toRow,
  toRows,
  toScalar,
  toScalars,
};
