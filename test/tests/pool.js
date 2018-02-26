/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });
global.Promise = Promise;

const fp = require('lodash/fp');
const { makeClient, makePool } = require('../../index');
const pg = require('pg');
const assert = require('assert');

function defaultPool({ maxClients = 1 } = {}) {
  return makePool({ makeClient: () => makeClient({ pg }), maxClients });
}

suite('Client Pool', () => {
  let db;

  function createTestTable() {
    return db
      .withClient(conn => {
        return Promise.all([
          conn.query('CREATE TABLE foo (foo_bar int);'),
          conn.query('CREATE TABLE fooid (id int, bar int);'),
        ]);
      })
      .then(fp.noop);
  }

  function dropTestTable() {
    return db
      .withClient(conn => {
        return Promise.all([
          conn.query('DROP TABLE IF EXISTS foo;', []),
          conn.query('DROP TABLE IF EXISTS fooid;', []),
        ]);
      })
      .then(fp.noop);
  }

  setup(done => {
    if (db) {
      db.drain();
    }
    db = defaultPool();
    dropTestTable()
      .then(() => {
        return createTestTable().then(() => {
          db.drain();
          db = null;
          done();
        });
      })
      .catch(done);
  });

  test('Use a db client', () => {
    db = defaultPool();
    return db.query('select 1');
  });

  test('Insert a row and select it', () => {
    db = defaultPool();
    return db
      .query('INSERT INTO foo VALUES ($1)', [1])
      .then(() => db.queryRows('SELECT * from foo;'))
      .then(([row]) => {
        assert.equal(row.foo_bar, 1);
      })
      .then(() => db.queryOne('SELECT * from foo;'))
      .then(row => {
        assert.equal(row.foo_bar, 1);
      });
  });

  test('Insert a row and select it -- in a transaction', () => {
    db = defaultPool();
    return db
      .transaction(client => {
        return client
          .query('INSERT INTO foo VALUES ($1)', [1])
          .then(() => client.queryRows('SELECT * from foo;'))
          .then(([row]) => {
            assert.equal(row.foo_bar, 1);
          })
          .then(() => client.queryOne('SELECT * from foo;'));
      })
      .then(row => {
        assert.equal(row.foo_bar, 1);
      });
  });

  test('Throw error if queryOne returns multiple result rows', () => {
    db = defaultPool();
    return db
      .query('INSERT INTO foo VALUES (1), (2)')
      .then(() => db.queryOne('SELECT * from foo;'))
      .then(
        () => {
          assert.fail('Expected an error');
        },
        err => {
          assert.equal(err.message, 'Expected 0 or 1 row');
        },
      );
  });

  test('Select nothing', () => {
    db = defaultPool();
    return db
      .queryRows('SELECT * from foo;')
      .then(rows => {
        assert.equal(rows.length, 0);
      })
      .then(() => db.queryOne('SELECT * from foo;'))
      .then(row => {
        assert.equal(row, undefined);
      });
  });

  test('deadlock on nested connection requests', () => {
    db = defaultPool();
    let gotFirstConnection = false;
    let gotSecondConnection = false;

    function grab2Conns() {
      return db.withClient(() => {
        gotFirstConnection = true;
        return db.withClient(() => {
          gotSecondConnection = true;
          return Promise.resolve();
        });
      });
    }

    return Promise.any([
      grab2Conns().then(() => {
        throw new Error('Exepected deadlock');
      }),
      Promise.delay(1000).then(() => {
        assert.equal(gotFirstConnection, true);
        assert.equal(gotSecondConnection, false);
      }),
    ]);
  });

  test("don't deadlock when pool has enough clients", () => {
    db = defaultPool({ maxClients: 2 });
    let gotFirstConnection = false;
    let gotSecondConnection = false;

    function grab2Conns() {
      return db.withClient(() => {
        gotFirstConnection = true;
        return db.withClient(() => {
          gotSecondConnection = true;
          return Promise.resolve();
        });
      });
    }

    return grab2Conns().then(() => {
      assert.equal(gotFirstConnection, true);
      assert.equal(gotSecondConnection, true);
    });
  });

  test("don't deadlock on parallel connection requests", () => {
    db = defaultPool();
    const gotConnection = fp.map(() => false, fp.range(0, 10));

    return Promise.all(
      fp.map(i => {
        return db.withClient(() => {
          gotConnection[i] = true;
          return Promise.delay(20);
        });
      }, fp.range(0, 10)),
    ).then(() => {
      assert(fp.all(fp.identity, gotConnection), 'Got all connections');
    });
  });

  test("don't deadlock on sequential connection requests", () => {
    db = defaultPool({ maxClients: 1 });

    const gotConnection = fp.map(() => {
      return false;
    }, fp.range(0, 3));

    return db
      .withClient(() => {
        gotConnection[0] = true;
        return Promise.delay(20);
      })
      .then(() => {
        return db.withClient(() => {
          gotConnection[1] = true;
          return Promise.delay(20);
        });
      })
      .then(() => {
        return db.withClient(() => {
          gotConnection[2] = true;
          return Promise.delay(20);
        });
      })
      .then(() => {
        assert(fp.all(fp.identity, gotConnection), 'Got all connections');
      });
  });

  test('rollback on application exception when in transaction', () => {
    db = defaultPool();
    return db
      .transaction(conn => {
        return conn
          .query('INSERT INTO foo VALUES (DEFAULT);')
          .then(() => Promise.reject('error'));
      })
      .catch(() => {
        return db.queryRows('SELECT count(*) from foo;').then(result => {
          assert.equal(result[0].count, '0');
        });
      });
  });

  test('rollback on db error when in transaction', () => {
    db = defaultPool();
    return db
      .transaction(conn => {
        return conn
          .query('INSERT INTO foo VALUES (DEFAULT);')
          .then(() => conn.query('bogus'));
      })
      .catch(() => {
        return db.queryRows('SELECT count(*) from foo;').then(result => {
          assert.equal(result[0].count, '0');
        });
      });
  });

  test('raw connection does not auto rollback', () => {
    db = defaultPool();
    return db
      .withClient(conn => {
        return conn
          .query('INSERT INTO foo VALUES (DEFAULT);')
          .then(() => conn.query('bogus'));
      })
      .catch(() => {
        return db.queryRows('SELECT count(*) from foo;').then(result => {
          assert.equal(result[0].count, '1');
        });
      });
  });

  test('write then read consistency', () => {
    db = defaultPool({ maxClients: 10 });
    let counter = 0;

    const update = 'UPDATE fooid SET bar = bar+1 WHERE id = 0;';
    const select = 'SELECT * from fooid;';
    return db.query('INSERT INTO fooid VALUES (0, 0);').then(() => {
      function again() {
        if (counter === 10) return null;

        return Promise.all([
          db.query(update),
          db.query(update),
          db.query(update),
          db.query(update),
        ]).then(() => {
          return db.queryRows(select).then(result => {
            assert.equal(result[0].bar, (counter + 1) * 4);
            counter += 1;
            return again(db);
          });
        });
      }
      return again(db);
    });
  });
});
