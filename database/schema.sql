-- =============================================================
-- DoubtBridge database schema (SQLite)
-- Every statement uses IF NOT EXISTS so it is safe to run again.
-- Timestamps are stored as ISO-8601 UTC strings, e.g. 2026-10-24T05:30:00.000Z
-- =============================================================

PRAGMA foreign_keys = ON;

-- 1. USERS — both students and professors live in one table.
--    role decides which extra columns are required.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('student', 'professor')),
  class_name    TEXT,                -- students only (e.g. TE)
  division      TEXT,                -- students only (e.g. A)
  status        TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'pending', 'rejected')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- A student must have class and division; a professor must not.
  CHECK (
    (role = 'student'   AND class_name IS NOT NULL AND division IS NOT NULL) OR
    (role = 'professor' AND class_name IS NULL     AND division IS NULL)
  )
);

-- 2. SUBJECTS — add a row here to create a new subject room.
CREATE TABLE IF NOT EXISTS subjects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE COLLATE NOCASE,   -- e.g. DAA
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. SUBJECT_PARTICIPANTS — many-to-many link between users and subjects.
--    The composite primary key stops a user joining the same room twice.
CREATE TABLE IF NOT EXISTS subject_participants (
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  joined_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, subject_id)
);

-- 4. DOUBTS — a question posted inside one subject room.
--    status: unanswered (0 replies) -> answered (1+ replies) -> resolved
CREATE TABLE IF NOT EXISTS doubts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'unanswered'
                      CHECK (status IN ('unanswered', 'answered', 'resolved')),
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 5. ANSWERS — replies to a doubt (one doubt has many answers).
CREATE TABLE IF NOT EXISTS answers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  doubt_id   INTEGER NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 6. NOTIFICATIONS — in-app alerts (emails are optional extras).
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,  -- who receives it
  actor_id   INTEGER          REFERENCES users(id)  ON DELETE SET NULL, -- who caused it
  doubt_id   INTEGER          REFERENCES doubts(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL CHECK (type IN ('answer', 'professor_answer', 'resolved')),
  message    TEXT    NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 7. SESSIONS — login sessions, so users stay logged in after a server restart.
CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT    PRIMARY KEY,
  sess    TEXT    NOT NULL,      -- JSON data
  expires INTEGER NOT NULL       -- milliseconds since 1970
);

-- Indexes make the most common lookups fast.
CREATE INDEX IF NOT EXISTS idx_doubts_subject_created ON doubts (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doubts_subject_status  ON doubts (subject_id, status);
CREATE INDEX IF NOT EXISTS idx_doubts_author          ON doubts (author_id);
CREATE INDEX IF NOT EXISTS idx_answers_doubt          ON answers (doubt_id, created_at);
CREATE INDEX IF NOT EXISTS idx_participants_subject   ON subject_participants (subject_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires       ON sessions (expires);
