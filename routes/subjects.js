/**
 * Subject routes: dashboard cards, room details, joining/leaving a room,
 * listing a room's doubts and posting a new doubt.
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { clean, validateDoubt, hasErrors } = require('../utils/validate');
const { DOUBT_SELECT, formatDoubt } = require('../services/doubtQueries');

const router = express.Router();
router.use(requireAuth);

/** Finds a subject by its code (e.g. "CN") or replies 404. */
function findSubject(db, code) {
  const subject = db.prepare('SELECT * FROM subjects WHERE code = ?').get(clean(code));
  if (!subject) throw new HttpError(404, 'Subject not found.');
  return subject;
}

function isMember(db, userId, subjectId) {
  return !!db
    .prepare('SELECT 1 FROM subject_participants WHERE user_id = ? AND subject_id = ?')
    .get(userId, subjectId);
}

// GET /api/subjects — all subject cards with live counts from the database
router.get('/', (req, res) => {
  const rows = req.app.locals.db
    .prepare(
      `SELECT s.id, s.code, s.name, s.description,
              (SELECT COUNT(*) FROM subject_participants p WHERE p.subject_id = s.id) AS participant_count,
              (SELECT COUNT(*) FROM doubts d WHERE d.subject_id = s.id AND d.status = 'unanswered') AS unanswered_count,
              (SELECT COUNT(*) FROM doubts d WHERE d.subject_id = s.id AND d.status <> 'resolved') AS unresolved_count,
              (SELECT COUNT(*) FROM doubts d WHERE d.subject_id = s.id) AS doubt_count,
              EXISTS (SELECT 1 FROM subject_participants p WHERE p.subject_id = s.id AND p.user_id = ?) AS joined
       FROM subjects s
       ORDER BY s.id`
    )
    .all(req.user.id);

  res.json({
    subjects: rows.map((s) => ({
      code: s.code,
      name: s.name,
      description: s.description,
      participantCount: s.participant_count,
      unansweredCount: s.unanswered_count,
      unresolvedCount: s.unresolved_count,
      doubtCount: s.doubt_count,
      joined: !!s.joined,
    })),
  });
});

// GET /api/subjects/:code — room header + participant list
router.get('/:code', (req, res) => {
  const db = req.app.locals.db;
  const subject = findSubject(db, req.params.code);

  const participants = db
    .prepare(
      `SELECT u.id, u.full_name, u.role, u.class_name, u.division, p.joined_at
       FROM subject_participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.subject_id = ?
       ORDER BY CASE u.role WHEN 'professor' THEN 0 ELSE 1 END, u.full_name COLLATE NOCASE`
    )
    .all(subject.id);

  res.json({
    subject: { code: subject.code, name: subject.name, description: subject.description },
    joined: isMember(db, req.user.id, subject.id),
    participantCount: participants.length,
    participants: participants.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      className: p.class_name,
      division: p.division,
      isYou: p.id === req.user.id,
    })),
  });
});

// POST /api/subjects/:code/join — join the room (joining twice is harmless)
router.post('/:code/join', (req, res) => {
  const db = req.app.locals.db;
  const subject = findSubject(db, req.params.code);
  db.prepare('INSERT OR IGNORE INTO subject_participants (user_id, subject_id) VALUES (?, ?)').run(
    req.user.id,
    subject.id
  );
  const count = db.prepare('SELECT COUNT(*) AS n FROM subject_participants WHERE subject_id = ?').get(subject.id).n;
  res.json({ joined: true, participantCount: count });
});

// DELETE /api/subjects/:code/join — leave the room (your doubts stay visible)
router.delete('/:code/join', (req, res) => {
  const db = req.app.locals.db;
  const subject = findSubject(db, req.params.code);
  db.prepare('DELETE FROM subject_participants WHERE user_id = ? AND subject_id = ?').run(req.user.id, subject.id);
  const count = db.prepare('SELECT COUNT(*) AS n FROM subject_participants WHERE subject_id = ?').get(subject.id).n;
  res.json({ joined: false, participantCount: count });
});

// GET /api/subjects/:code/doubts?status=all|unresolved|unanswered|answered|resolved&q=keyword
router.get('/:code/doubts', (req, res) => {
  const db = req.app.locals.db;
  const subject = findSubject(db, req.params.code);

  const where = ['d.subject_id = ?'];
  const params = [subject.id];

  const status = clean(req.query.status) || 'all';
  if (['unanswered', 'answered', 'resolved'].includes(status)) {
    where.push('d.status = ?');
    params.push(status);
  } else if (status === 'unresolved') {
    where.push("d.status <> 'resolved'");
  } else if (status !== 'all') {
    throw new HttpError(400, 'Unknown status filter.');
  }

  const q = clean(req.query.q).slice(0, 100);
  if (q) {
    // Escape LIKE wildcards so "%" or "_" typed by the user are matched literally.
    const pattern = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    where.push("(d.title LIKE ? ESCAPE '\\' OR d.description LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }

  const rows = db
    .prepare(`${DOUBT_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC, d.id DESC LIMIT 200`)
    .all(...params);

  res.json({ doubts: rows.map((row) => formatDoubt(row, req.user)) });
});

// POST /api/subjects/:code/doubts — ask a new doubt in this room
router.post('/:code/doubts', (req, res) => {
  const db = req.app.locals.db;
  const subject = findSubject(db, req.params.code);

  if (!isMember(db, req.user.id, subject.id)) {
    throw new HttpError(403, 'Join this subject room before asking a doubt.');
  }

  // Only title and description come from the form. Author, class, division
  // and subject come from the session and the URL — never from the browser body.
  const { data, errors } = validateDoubt(req.body || {});
  if (hasErrors(errors)) throw new HttpError(400, 'Please fix the highlighted fields.', errors);

  const id = db
    .prepare('INSERT INTO doubts (subject_id, author_id, title, description) VALUES (?, ?, ?, ?)')
    .run(subject.id, req.user.id, data.title, data.description).lastInsertRowid;

  const row = db.prepare(`${DOUBT_SELECT} WHERE d.id = ?`).get(id);
  res.status(201).json({ doubt: formatDoubt(row, req.user) });
});

module.exports = router;
