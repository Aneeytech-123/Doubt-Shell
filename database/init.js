/**
 * Creates the database tables and the default subjects.
 *   npm run db:init          -> safe to run many times, keeps existing data
 *   npm run db:reset         -> DELETES the database file and starts fresh
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { openDatabase, seedSubjects } = require('./db');

const reset = process.argv.includes('--reset');
const dbFile = path.resolve(config.dbPath);

if (reset) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (fs.existsSync(dbFile + suffix)) fs.unlinkSync(dbFile + suffix);
  }
  console.log('Old database removed.');
}

const db = openDatabase(dbFile);
seedSubjects(db);

const counts = {
  subjects: db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n,
  users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  doubts: db.prepare('SELECT COUNT(*) AS n FROM doubts').get().n,
};
db.close();

console.log(`Database ready at ${dbFile}`);
console.log(`Subjects: ${counts.subjects} | Users: ${counts.users} | Doubts: ${counts.doubts}`);
