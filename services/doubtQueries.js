/**
 * Shared SQL + formatting for doubts, used by several route files.
 */

// Joins each doubt with its author, subject and live reply count.
const DOUBT_SELECT = `
  SELECT d.id, d.title, d.description, d.status, d.created_at, d.updated_at, d.resolved_at,
         d.author_id, u.full_name AS author_name, u.role AS author_role,
         u.class_name AS author_class, u.division AS author_division,
         s.code AS subject_code, s.name AS subject_name,
         r.full_name AS resolved_by_name,
         (SELECT COUNT(*) FROM answers a WHERE a.doubt_id = d.id) AS reply_count
  FROM doubts d
  JOIN users u    ON u.id = d.author_id
  JOIN subjects s ON s.id = d.subject_id
  LEFT JOIN users r ON r.id = d.resolved_by`;

/** Who may mark a doubt resolved: its author, or any professor. */
function canResolve(doubtAuthorId, user) {
  return user.id === doubtAuthorId || user.role === 'professor';
}

function formatDoubt(row, currentUser) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    replyCount: row.reply_count,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by_name || null,
    subject: { code: row.subject_code, name: row.subject_name },
    author: {
      id: row.author_id,
      fullName: row.author_name,
      role: row.author_role,
      className: row.author_class,
      division: row.author_division,
    },
    isMine: row.author_id === currentUser.id,
    canResolve: canResolve(row.author_id, currentUser),
  };
}

module.exports = { DOUBT_SELECT, formatDoubt, canResolve };
