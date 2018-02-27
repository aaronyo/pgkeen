const fp = require('lodash/fp');
const { client: clientMethods } = require('../lib');
const { makeComponent } = require('./helpers');
const util = require('../lib/util');

async function makeClient({
  pg,
  url = 'postgres://localhost:5432/postgres',
  mixinMethods = {},
}) {
  const pgClient = new pg.Client(util.parseConnectionUrl(url));
  pgClient.connect();

  return makeComponent({
    name: 'client',
    state: { pgClient },
    methods: fp.assign(clientMethods, mixinMethods),
  });
}

module.exports = makeClient;
