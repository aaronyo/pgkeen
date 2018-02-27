const fp = require('lodash/fp');

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

module.exports = { withClient, drain };
