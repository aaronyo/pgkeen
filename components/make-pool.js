const fp = require('lodash/fp');
const genericPoolLib = require('generic-pool');

function makePool({
  makeClient, // required
  maxClients = 1,
  minClients = 1,
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

  const clientPool = {
    // Instead of returning clients, we accept a function to apply on a client
    // and then auto release the client.
    //
    // Requiring users to release clients inevitably leads to client leaks.
    withClient(fn) {
      return genericPool.acquire().then(client => {
        const onResult = fn(client);
        if (!fp.isFunction(fp.get('then', onResult))) {
          genericPool.release(client);
          throw new Error('Function must return a promise: ' + fn.toString());
        }
        return onResult.then(
          result => {
            genericPool.release(client);
            return result;
          },
          err => {
            genericPool.release(client);
            throw err;
          },
        );
      });
    },
    drain() {
      return genericPool.drain().then(() => {
        return genericPool.clear();
      });
    },
  };

  fp.each(
    delegateName => {
      // eslint-disable-next-line func-names
      clientPool[delegateName] = function(...args) {
        return clientPool.withClient(client => {
          return client[delegateName](...args);
        });
      };
    },
    ['query', 'queryRows', 'queryOne', 'transaction'],
  );

  return clientPool;
}

module.exports = makePool;
