/**
 * server.js — entry point. Run with `npm start`.
 */
const config = require('./config');
const { openDatabase, seedSubjects } = require('./database/db');
const { createApp } = require('./app');

const db = openDatabase(config.dbPath);
seedSubjects(db); // makes sure DAA, CN and WT exist even if db:init was skipped

const app = createApp({ db });

const server = app.listen(config.port, () => {
  console.log(`DoubtBridge running at http://localhost:${config.port}`);
  console.log(`Professor registration policy: ${config.professorPolicy}`);
  if (config.usingTemporarySecret) {
    console.warn('Warning: SESSION_SECRET is not set in .env, so logins reset when the server restarts.');
  }
  console.log(app.locals.mailer.enabled ? 'Email notifications: ON' : 'Email notifications: OFF (no SMTP_HOST)');
});

// Close the database cleanly on Ctrl+C
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
