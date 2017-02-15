/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const fp = require('lodash/fp');
const Client = require('../index.js').Client;
const assert = require('assert');

suite('Client', () => {
  let db;

  function createTestTable() {
    return db
      .connection(conn => {
        return Promise.all([
          conn.query('CREATE TABLE foo (bar int);'),
          conn.query('CREATE TABLE fooid (id int, bar int);')
        ]);
      })
      .then(fp.noop);
  }

  function dropTestTable() {
    return db
      .connection(conn => {
        return Promise.all([
          conn.query('DROP TABLE IF EXISTS foo;'),
          conn.query('DROP TABLE IF EXISTS fooid;')
        ]);
      })
      .then(fp.noop);
  }

  setup(done => {
    if (db) {
      db.close();
    }
    db = new Client({ pool: { max: 1 } });
    dropTestTable()
      .then(() => {
        return createTestTable().then(() => {
          db.close();
          db = null;
          done();
        });
      })
      .catch(done);
  });

  test('Use a db client', () => {
    db = new Client();
    return db.query('select 1');
  });

  test('Event listeners', () => {
    let query;
    let result;
    db = new Client({
      eventListeners: {
        query: (q, r) => {
          query = [q, r];
        },
        result: (q, v, r) => {
          result = [q, v, r];
        }
      }
    });
    return db.query('select 1 as num limit $1', [2]).then(() => {
      assert.deepEqual(query, ['select 1 as num limit $1', [2]]);
      assert.deepEqual(result.slice(0, 2), query);
      assert.deepEqual(result[2].rows, [{ num: 1 }]);
    });
  });

  test('Insert a row and select it', () => {
    db = new Client({ pool: { max: 1 } });
    return db
      .query('INSERT INTO foo VALUES ($1)', [1])
      .then(() => db.query('SELECT * from foo;'))
      .then(([row]) => {
        assert.equal(row.bar, 1);
      })
      .then(() => db.queryFirst('SELECT * from foo;'))
      .then(row => {
        assert.equal(row.bar, 1);
      });
  });

  test('deadlock on nested connection requests', () => {
    db = new Client({ pool: { max: 1 } });
    let gotFirstConnection = false;
    let gotSecondConnection = false;

    function grab2Conns() {
      return db.connection(() => {
        gotFirstConnection = true;
        return db.connection(() => {
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
      })
    ]);
  });

  test("don't deadlock on parallel connection requests", () => {
    db = new Client({ pool: { max: 1 } });
    const gotConnection = fp.map(() => false, fp.range(0, 10));

    return Promise.all(
      fp.map(
        i => {
          return db.connection(() => {
            gotConnection[i] = true;
            return Promise.delay(20);
          });
        },
        fp.range(0, 10)
      )
    ).then(() => {
      assert(fp.all(fp.identity, gotConnection), 'Got all connections');
    });
  });

  test("don't deadlock on sequential connection requests", () => {
    db = new Client({ poolSize: 1 });

    const gotConnection = fp.map(
      () => {
        return false;
      },
      fp.range(0, 3)
    );

    return db
      .connection(() => {
        gotConnection[0] = true;
        return Promise.delay(20);
      })
      .then(() => {
        return db.connection(() => {
          gotConnection[1] = true;
          return Promise.delay(20);
        });
      })
      .then(() => {
        return db.connection(() => {
          gotConnection[2] = true;
          return Promise.delay(20);
        });
      })
      .then(() => {
        assert(fp.all(fp.identity, gotConnection), 'Got all connections');
      });
  });

  test('rollback on application exception when in transaction', () => {
    db = new Client({ pool: { max: 1 } });
    return db
      .transaction(conn => {
        return conn
          .query('INSERT INTO foo VALUES (DEFAULT);')
          .then(() => Promise.reject('error'));
      })
      .catch(() => {
        return db.query('SELECT count(*) from foo;').then(result => {
          assert.equal(result[0].count, '0');
        });
      });
  });

  test('rollback on db error when in transaction', () => {
    db = new Client({ pool: { max: 1 } });
    return db
      .transaction(conn => {
        return conn
          .query('INSERT INTO foo VALUES (DEFAULT);')
          .then(() => conn.query('bogus'));
      })
      .catch(() => {
        return db.query('SELECT count(*) from foo;').then(result => {
          assert.equal(result[0].count, '0');
        });
      });
  });

  test('raw connection does not auto rollback', () => {
    db = new Client({ pool: { max: 1 } });
    return db
      .connection(conn => {
        return conn
          .query('INSERT INTO foo VALUES (DEFAULT);')
          .then(() => conn.query('bogus'));
      })
      .catch(() => {
        return db.query('SELECT count(*) from foo;').then(result => {
          assert.equal(result[0].count, '1');
        });
      });
  });

  test('write then read consistency', () => {
    db = new Client({ pool: { max: 10 } });
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
          db.query(update)
        ]).then(() => {
          return db.query(select).then(result => {
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
