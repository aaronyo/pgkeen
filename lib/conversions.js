const assert = require('assert');
const fp = require('lodash/fp');

function asRows(result) {
  return result.rows;
}

function asRow(result) {
  const rows = asRows(result);
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

function asScalar(result) {
  return rowToScalar(asRow(result));
}

function asScalars(result) {
  return fp.map(rowToScalar, asRows(result));
}

module.exports = {
  asRow,
  asRows,
  asScalar,
  asScalars,
  asResults: fp.identity,
};
