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

function asScalar(result) {
  const row = asRow(result);
  if (row === null) return null;
  const values = fp.values(row);
  assert(
    (values.length = 1),
    'Expected a single value: ' + JSON.stringify(values),
  );
  return values[0];
}

function asScalars(result) {
  return fp.map(asScalar, asRows(result));
}

function returnsRow(fn) {
  return async (...args) => asRow(await fn(...args));
}

function returnsRows(fn) {
  return async (...args) => asRows(await fn(...args));
}

function returnsScalar(fn) {
  return async (...args) => asScalar(await fn(...args));
}

function returnsScalars(fn) {
  return async (...args) => asScalars(await fn(...args));
}

module.exports = {
  asRow,
  asRows,
  asScalar,
  asScalars,
  returnsRow,
  returnsRows,
  returnsScalar,
  returnsScalars,
};
