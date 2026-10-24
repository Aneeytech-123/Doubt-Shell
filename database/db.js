/**
 * db.js — opens the SQLite database and makes sure the tables exist.
 *
 * We use better-sqlite3, which runs queries synchronously. That keeps the
 * code simple to read: `db.prepare(sql).get(params)` returns the row directly.
 * All queries use "?" placeholders (parameterized queries) so user input can
 * never change the SQL itself — this is how we prevent SQL injection.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const subjects = require('./subjects');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');       // enforce REFERENCES constraints
  if (dbPath !== ':memory:') db.pragma('journal_mode = WAL'); // better concurrency
  db.exec(schemaSql);                   // create tables if they don't exist
  return db;
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

module.exports = { openDatabase, seedSubjects };
