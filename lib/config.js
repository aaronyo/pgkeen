let _Promise = require('bluebird');

function configure({ Promise = _Promise }) {
  _Promise = Promise;
}

function getPromise() {
  return _Promise;
}

module.exports = { configure, getPromise };
