const fp = require('lodash/fp');

function makeComponent({ name, state, methods }) {
  const self = {};
  return Object.assign(
    self,
    fp.mapValues(
      fn => fp.partial(fn, [fp.assign(state, { [name]: self })]),
      methods,
    ),
  );
}

module.exports = { makeComponent };
