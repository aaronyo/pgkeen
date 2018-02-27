const fp = require('lodash/fp');
const genericPoolLib = require('generic-pool');
const { makeComponent } = require('./helpers');
const { pool: poolMethods } = require('../lib');

function makePool({
  makeClient, // required
  maxClients = 1,
  minClients = 1,
  mixinMethods = {},
  clientDelegates = [],
  onMakeClientError = fp.noop,
  onDisconnectClientError = fp.noop,
}) {
  const clientFactory = {
    create() {
      return makeClient();
    },
    destroy(client) {
      client.disconnect();
    },
  };

  const genericPool = genericPoolLib.createPool(clientFactory, {
    max: maxClients,
    min: minClients,
  });

  genericPool.on('factoryCreateError', onMakeClientError);
  genericPool.on('factoryDestroyError', onDisconnectClientError);

  const pool = makeComponent({
    name: 'pool',
    state: { genericPool },
    methods: fp.assign(poolMethods, mixinMethods),
  });

  fp.each(delegateName => {
    // eslint-disable-next-line func-names
    pool[delegateName] = function(...args) {
      return pool.withClient(client => {
        return client[delegateName](...args);
      });
    };
  }, fp.flatten([['query', 'queryRows', 'queryOne', 'transaction'], clientDelegates]));

  return pool;
}

module.exports = makePool;
