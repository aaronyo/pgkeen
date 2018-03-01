const fp = require('lodash/fp');
const { makeComponent } = require('./helpers');
const { pool: poolLib } = require('../lib');

function makePool({
  makeClient, // required
  maxClients = 1,
  minClients = 1,
  mixinMethods = {},
  clientDelegates = [],
  onMakeClientError = fp.noop,
  onDisconnectClientError = fp.noop,
}) {
  const genericPool = poolLib.makeGenericPool({
    makeClient,
    onMakeClientError,
    onDisconnectClientError,
    minClients,
    maxClients,
  });

  const pool = makeComponent({
    name: 'pool',
    state: { genericPool },
    methods: fp.assign(fp.pick(['withClient', 'drain'], poolLib), mixinMethods),
  });

  return poolLib.addDelegates(
    ['query', 'queryRows', 'queryOne', 'transaction', ...clientDelegates],
    pool,
  );
}

module.exports = makePool;
