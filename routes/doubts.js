/**
 * Doubt routes: discussion view, posting answers and resolving doubts.
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { validateAnswer, toId, hasErrors } = require('../utils/validate');
const { DOUBT_SELECT, formatDoubt, canResolve } = require('../services/doubtQueries');
const { notify } = require('../services/notifications');

const router = express.Router();
router.use(requireAuth);

function loadDoubt(db, idParam) {
  const id = toId(idParam);
  const row = id && db.prepare(`${DOUBT_SELECT} WHERE d.id = ?`).get(id);
  if (!row) throw new HttpError(404, 'Doubt not found.');
  return row;
}

function listAnswers(db, doubtId) {
  return db
    .prepare(
      `SELECT a.id, a.body, a.created_at, a.author_id,
              u.full_name, u.role, u.class_name, u.division
       FROM answers a JOIN users u ON u.id = a.author_id
       WHERE a.doubt_id = ?
       ORDER BY a.created_at ASC, a.id ASC`
    )
    .all(doubtId)
    .map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.created_at,
      author: {
        id: a.author_id,
        fullName: a.full_name,
        role: a.role,
        className: a.class_name,
        division: a.division,
      },
    }));
}

// GET /api/doubts/:id — full discussion: question + all answers
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const row = loadDoubt(db, req.params.id);
  res.json({ doubt: formatDoubt(row, req.user), answers: listAnswers(db, row.id) });
});

// POST /api/doubts/:id/answers — reply to a doubt
router.post('/:id/answers', (req, res) => {
  const db = req.app.locals.db;
  const mailer = req.app.locals.mailer;
  const row = loadDoubt(db, req.params.id);

  const member = db
    .prepare(
      'SELECT 1 FROM subject_participants p JOIN subjects s ON s.id = p.subject_id WHERE p.user_id = ? AND s.code = ?'
    )
    .get(req.user.id, row.subject_code);
  if (!member) throw new HttpError(403, 'Join this subject room before answering.');

  const { data, errors } = validateAnswer(req.body || {});
  if (hasErrors(errors)) throw new HttpError(400, 'Please fix the highlighted fields.', errors);

  // A transaction makes the answer + status change + notification succeed or fail together.
  const answerId = db.transaction(() => {
    const id = db
      .prepare('INSERT INTO answers (doubt_id, author_id, body) VALUES (?, ?, ?)')
      .run(row.id, req.user.id, data.body).lastInsertRowid;

    db.prepare(
      `UPDATE doubts
       SET status = CASE WHEN status = 'unanswered' THEN 'answered' ELSE status END,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).run(row.id);

    // Tell the question's author — unless they answered their own doubt.
    if (row.author_id !== req.user.id) {
      const isProfessor = req.user.role === 'professor';
      notify(db, mailer, {
        userId: row.author_id,
        actorId: req.user.id,
        doubtId: row.id,
        subjectCode: row.subject_code,
        type: isProfessor ? 'professor_answer' : 'answer',
        message: isProfessor
          ? `Professor ${req.user.full_name} responded to your doubt "${row.title}" in ${row.subject_code}.`
          : `${req.user.full_name} answered your doubt "${row.title}" in ${row.subject_code}.`,
        emailSubject: isProfessor ? 'A professor responded to your doubt' : 'New answer to your doubt',
      });
    }
    return id;
  })();

  const answer = listAnswers(db, row.id).find((a) => a.id === Number(answerId));
  const updated = db.prepare(`${DOUBT_SELECT} WHERE d.id = ?`).get(row.id);
  res.status(201).json({ answer, doubt: formatDoubt(updated, req.user) });
});

// PATCH /api/doubts/:id/resolve  body: { "resolved": true | false }
router.patch('/:id/resolve', (req, res) => {
  const db = req.app.locals.db;
  const mailer = req.app.locals.mailer;
  const row = loadDoubt(db, req.params.id);

  if (!canResolve(row.author_id, req.user)) {
    throw new HttpError(403, 'Only the person who asked this doubt or a professor can change its status.');
  }

  const resolved = !req.body || req.body.resolved !== false; // default: resolve

  db.transaction(() => {
    if (resolved) {
      db.prepare(
        `UPDATE doubts SET status = 'resolved', resolved_by = ?,
           resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(req.user.id, row.id);

      if (row.status !== 'resolved' && row.author_id !== req.user.id) {
        notify(db, mailer, {
          userId: row.author_id,
          actorId: req.user.id,
          doubtId: row.id,
          subjectCode: row.subject_code,
          type: 'resolved',
          message: `${req.user.full_name} marked your doubt "${row.title}" as resolved.`,
          emailSubject: 'Your doubt was marked as resolved',
        });
      }
    } else {
      // Re-open: go back to "answered" if it has replies, otherwise "unanswered".
      db.prepare(
        `UPDATE doubts
         SET status = CASE WHEN (SELECT COUNT(*) FROM answers WHERE doubt_id = doubts.id) > 0
                           THEN 'answered' ELSE 'unanswered' END,
             resolved_by = NULL, resolved_at = NULL,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`
      ).run(row.id);
    }
  })();

  const updated = db.prepare(`${DOUBT_SELECT} WHERE d.id = ?`).get(row.id);
  res.json({ doubt: formatDoubt(updated, req.user) });
});

module.exports = router;
