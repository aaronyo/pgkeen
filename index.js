const Client = require('./lib/client');
const parameterize = require('./lib/parameterize').parameterize;
const sqlFiles = require('./lib/sql-files');

module.exports = { Client, parameterize, sqlFiles };
