/**
 * A small session store that saves express-session data in SQLite,
 * so users stay logged in even after the server restarts.
 * express-session calls get / set / destroy / touch for us.
 */
const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
    this.setStmt = db.prepare(
      'INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ' +
      'ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires'
    );
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this.cleanupStmt = db.prepare('DELETE FROM sessions WHERE expires <= ?');

    // Remove expired sessions every hour (unref() lets the process exit normally).
    this.timer = setInterval(() => this.cleanupStmt.run(Date.now()), 60 * 60 * 1000);
    this.timer.unref();
  }

  expiryOf(sess) {
    const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 24 * 60 * 60 * 1000;
    return Date.now() + maxAge;
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb) {
    try {
      this.setStmt.run(sid, JSON.stringify(sess), this.expiryOf(sess));
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  destroy(sid, cb) {
    try {
      this.destroyStmt.run(sid);
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  touch(sid, sess, cb) {
    try {
      this.touchStmt.run(this.expiryOf(sess), sid);
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  close() {
    clearInterval(this.timer);
  }
}

module.exports = SQLiteSessionStore;
