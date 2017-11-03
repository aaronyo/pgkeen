const Client = require('./lib/client');
const parameterize = require('./lib/parameterize').parameterize;
const sqlFiles = require('./lib/sql-files');
const { synchronized } = require('./lib/util');
const { configure } = require('./lib/config');

module.exports = { Client, parameterize, sqlFiles, configure, synchronized };
