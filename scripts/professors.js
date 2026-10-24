/**
 * Administrator tool for professor accounts (run on the server's terminal).
 *
 *   npm run professors:list                       -> show all professor accounts
 *   npm run professors:approve -- prof@college.edu -> allow this professor to log in
 *   npm run professors:reject  -- prof@college.edu -> block this registration
 *
 * Only someone with access to the server (the administrator) can run this,
 * which is why a student cannot simply register as a professor to gain privileges.
 */
const config = require('../config');
const { openDatabase } = require('../database/db');

const [command, emailArg] = process.argv.slice(2);
const db = openDatabase(config.dbPath);

function setStatus(status) {
  const email = (emailArg || '').trim().toLowerCase();
  if (!email) {
    console.error(`Usage: npm run professors:${command} -- professor@email.com`);
    process.exitCode = 1;
    return;
  }
  const result = db
    .prepare("UPDATE users SET status = ? WHERE email = ? AND role = 'professor'")
    .run(status, email);
  if (result.changes === 0) {
    console.error(`No professor account found for ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${email} is now ${status === 'active' ? 'APPROVED (active)' : 'REJECTED'}.`);
  }
}

if (command === 'list') {
  const rows = db
    .prepare("SELECT full_name, email, status, created_at FROM users WHERE role = 'professor' ORDER BY status, created_at")
    .all();
  if (rows.length === 0) console.log('No professor accounts yet.');
  else console.table(rows);
} else if (command === 'approve') {
  setStatus('active');
} else if (command === 'reject') {
  setStatus('rejected');
} else {
  console.log('Commands: list | approve <email> | reject <email>');
}

db.close();
