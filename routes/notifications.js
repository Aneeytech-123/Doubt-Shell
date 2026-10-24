/**
 * Notification routes. A user can only ever see or change their OWN
 * notifications: every query includes "user_id = req.user.id".
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { toId } = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications — newest first
router.get('/', (req, res) => {
  const rows = req.app.locals.db
    .prepare(
      `SELECT n.id, n.type, n.message, n.is_read, n.created_at, n.doubt_id, s.code AS subject_code
       FROM notifications n
       LEFT JOIN doubts d   ON d.id = n.doubt_id
       LEFT JOIN subjects s ON s.id = d.subject_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 100`
    )
    .all(req.user.id);

  res.json({
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      isRead: !!n.is_read,
      createdAt: n.created_at,
      link: n.doubt_id && n.subject_code ? `/subjects/${n.subject_code}?doubt=${n.doubt_id}` : null,
    })),
  });
});

// GET /api/notifications/unread-count — for the bell badge
router.get('/unread-count', (req, res) => {
  const { n } = req.app.locals.db
    .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);
  res.json({ unread: n });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  const id = toId(req.params.id);
  const result = req.app.locals.db
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(id, req.user.id);
  if (result.changes === 0) throw new HttpError(404, 'Notification not found.');
  res.json({ ok: true });
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  req.app.locals.db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
