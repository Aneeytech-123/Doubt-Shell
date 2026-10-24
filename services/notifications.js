/**
 * Creates in-app notifications (stored in SQLite) and, when SMTP is
 * configured, also sends an email copy in the background.
 */
const config = require('../config');

function notify(db, mailer, { userId, actorId, doubtId, type, message, emailSubject, subjectCode }) {
  const result = db
    .prepare(
      'INSERT INTO notifications (user_id, actor_id, doubt_id, type, message) VALUES (?, ?, ?, ?, ?)'
    )
    .run(userId, actorId || null, doubtId || null, type, message);

  if (mailer && mailer.enabled) {
    const recipient = db.prepare('SELECT email, full_name FROM users WHERE id = ?').get(userId);
    if (recipient) {
      const link = subjectCode && doubtId
        ? `${config.appUrl}/subjects/${encodeURIComponent(subjectCode)}?doubt=${doubtId}`
        : `${config.appUrl}/notifications`;
      // Not awaited on purpose: the user's request should not wait for the email server.
      mailer.send({
        to: recipient.email,
        subject: emailSubject || 'New activity on DoubtBridge',
        text: `Hi ${recipient.full_name},\n\n${message}\n\nOpen the discussion: ${link}\n\n— DoubtBridge`,
      });
    }
  }

  return result.lastInsertRowid;
}

module.exports = { notify };
