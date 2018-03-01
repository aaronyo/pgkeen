const fp = require('lodash/fp');
const genericPoolLib = require('generic-pool');

function makeGenericPool(opts) {
  const clientFactory = {
    create() {
      return opts.makeClient();
    },
    destroy(client) {
      client.disconnect();
    },
  };

  const genericPool = genericPoolLib.createPool(clientFactory, {
    min: opts.minClients,
    max: opts.maxClients,
  });
  genericPool.on('factoryCreateError', opts.onMakeClientError);
  genericPool.on('factoryDestroyError', opts.onDisconnectClientError);

  return genericPool;
}

function addDelegates(delegateNames, pool) {
  return fp.assign(
    pool,
    fp.fromPairs(
      fp.map(
        delegateName => [
          delegateName,
          (...args) => {
            return pool.withClient(client => {
              return client[delegateName](...args);
            });
          },
        ],
        delegateNames,
      ),
    ),
  );
}

// Instead of returning clients, we accept a function to apply on a client
// and then auto release and destroy clients as necessary.
//
// Requiring users to release or destroy clients inevitably leads to client
// leaks and busted clients in the pool.
function withClient({ genericPool }, fn) {
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
        genericPool.destroy(client);
        throw err;
      },
    );
  });
}

function drain({ genericPool }) {
  return genericPool.drain().then(() => {
    return genericPool.clear();
  });
}

module.exports = {
  makeGenericPool,
  addDelegates,
  withClient,
  drain,
};
