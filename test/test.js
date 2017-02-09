/* global suite: false, test: false, setup: false */
const Promise = require('bluebird');

Promise.config({ longStackTraces: true });

const fp = require('lodash/fp');
const Client = require('../index.js').Client;
const assert = require('assert');

const _ = null;

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

  return;

  test('raw connection does not auto rollback', function(done) {
    db = createDb({ poolSize: 1 });
    var inserting = db.connection(function(conn) {
      var querying = conn.query('INSERT INTO foo VALUES (DEFAULT);');
      var erroring = Promise.reject('error');
      return Promise.all([querying, erroring]);
    });

    inserting
      .catch(function() {
        return db.query('SELECT count(*) from foo;').then(function(result) {
          assert.equal(result[0].count, '1');
          done();
        });
      })
      .catch(done);
  });

  test('prepare a statement', function(done) {
    db = createDb({ poolSize: 10 });

    db.loadStatement(__dirname + '/test_query.sql').then(function(statement) {
      return db
        .query('INSERT INTO foo VALUES (1), (2), (3), (4);')
        .then(function() {
          return db.exec(statement, 2);
        })
        .then(function(result) {
          assert.equal(result.length, 2);
          done();
        })
        .catch(done);
    });
  });

  test('prepare all statements in a directory', function(done) {
    db = createDb({ loadpath: __dirname, poolSize: 10 });

    var statements = db
      .loadStatements(__dirname + '/test_sql')
      .then(function(statements) {
        return db
          .exec(statements.select1)
          .then(function(rows) {
            assert.equal(rows[0].one, 1);
          })
          .then(function() {
            return db.execTemplate(statements.select2);
          })
          .then(function(rows) {
            assert.equal(rows[0].two, 2);
          })
          .then(done, done);
      });
  });

  test('parseNamedParams', function() {
    var text = '--' + '-- $1: foo' + '-- $2: bar' + '--';

    var actual = client.parseNamedParams(text);
    assert.equal(actual[0], 'foo');
    assert.equal(actual[1], 'bar');
  });

  test('prepare statemnt with named args', function(done) {
    db = createDb({ poolSize: 10 });

    db
      .loadStatement(__dirname + '/select_named_args.sql')
      .then(function(statement) {
        return db.exec(statement, {
          foo: 'F',
          bar: 'B'
        });
      })
      .then(function(rows) {
        assert.equal(rows[0].foo, 'F');
        assert.equal(rows[0].bar, 'B');
      })
      .then(done, done);
  });

  test('prepare a statement from a template', function(done) {
    db = createDb({ poolSize: 10 });

    db
      .loadStatement(__dirname + '/test_query_template.sql.hbs')
      .then(function(statement) {
        return db
          .query('INSERT INTO foo VALUES (1), (2), (3), (4);')
          .then(function() {
            return db.execTemplate(statement, { direction: 'DESC' }, 2);
          })
          .then(function(result) {
            assert.equal(result.length, 2);
            assert.equal(result[0].bar, 4);
            assert.equal(result[1].bar, 3);
            done();
          });
      })
      .catch(done);
  });

  test('db.exec: write then read consistency', function(done) {
    db = createDb({ loadpath: __dirname, poolSize: 10 });
    var counter = 0;

    var update = 'UPDATE fooid SET bar = bar+1 WHERE id = 0;';
    var select = 'SELECT * from fooid;';
    return db
      .query('INSERT INTO fooid VALUES (0, 0);')
      .then(function() {
        function again(db) {
          if (counter === 10) return;

          return Promise.all([
            db.exec(update),
            db.exec(update),
            db.exec(update),
            db.exec(update)
          ]).then(function() {
            return db.exec(select).then(function(result) {
              assert.equal(result[0].bar, (counter + 1) * 4);
              counter += 1;
              return again(db);
            });
          });
        }
        return again(db);
      })
      .catch(function(err) {
        console.log(err.cause);
        throw err;
      })
      .then(
        function() {
          done();
        },
        done
      );
  });
});
