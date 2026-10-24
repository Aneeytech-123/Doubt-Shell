/**
 * db.js — opens the SQLite database and makes sure the tables exist.
 *
 * We use node:sqlite, the SQLite driver built into Node.js (22.13+), so there
 * is nothing extra to install or compile. Queries run synchronously, which
 * keeps the code simple: `db.prepare(sql).get(params)` returns the row directly.
 * All queries use "?" placeholders (parameterized queries) so user input can
 * never change the SQL itself — this is how we prevent SQL injection.
 */
const fs = require('fs');
const path = require('path');

// node:sqlite prints an "experimental feature" warning on some Node versions.
// Hide only that one message so the terminal stays readable.
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  if (String(warning && warning.message ? warning.message : warning).includes('SQLite')) return;
  return originalEmitWarning.call(process, warning, ...args);
};
const { DatabaseSync } = require('node:sqlite');
process.emitWarning = originalEmitWarning;

const subjects = require('./subjects');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

/**
 * db.transaction(fn) returns a function that runs fn inside BEGIN ... COMMIT.
 * If anything throws, ROLLBACK undoes every change made inside it.
 */
function addTransactionHelper(db) {
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');                          // enforce REFERENCES constraints
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;'); // better concurrency
  db.exec(schemaSql);                                            // create tables if they don't exist
  addTransactionHelper(db);
  return db;
}

/** True when an error is a UNIQUE constraint violation (e.g. duplicate email). */
function isUniqueViolation(err) {
  return err && (err.errcode === 2067 || /UNIQUE constraint failed/i.test(err.message || ''));
}

/** Inserts the default subjects. Existing subjects are left untouched. */
function seedSubjects(db) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO subjects (code, name, description) VALUES (?, ?, ?)'
  );
  const insertAll = db.transaction((list) => {
    for (const s of list) insert.run(s.code, s.name, s.description);
  });
  insertAll(subjects);
}

module.exports = { openDatabase, seedSubjects, isUniqueViolation };
