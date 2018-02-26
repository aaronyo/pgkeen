const fp = require('lodash/fp');
const clientLib = require('./client');
const parameterizeLib = require('./parameterize');
const utilLib = require('./util');
const synchronized = require('./synchronized');

module.exports = fp.assignAll([
  clientLib,
  parameterizeLib,
  utilLib,
  { synchronized },
]);
