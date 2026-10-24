/**
 * OPTIONAL demonstration data for testing and the viva demo.
 *   npm run db:seed-demo
 *
 * Every account created here is clearly fake: names start with "Demo" and
 * emails use the reserved example.com domain. Password for all: Demo@1234
 * Do NOT run this on a real deployment.
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const { openDatabase, seedSubjects } = require('./db');

const DEMO_PASSWORD = 'Demo@1234';
const db = openDatabase(config.dbPath);
seedSubjects(db);

const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (full_name, email, password_hash, role, class_name, division, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')`);

const demoUsers = [
  ['Demo Student One', 'demo.student1@example.com', 'student', 'TE', 'A'],
  ['Demo Student Two', 'demo.student2@example.com', 'student', 'TE', 'B'],
  ['Demo Professor', 'demo.professor@example.com', 'professor', null, null],
];

const userId = (email) => db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
const subjectId = (code) => db.prepare('SELECT id FROM subjects WHERE code = ?').get(code).id;

db.transaction(() => {
  for (const [name, email, role, cls, div] of demoUsers) {
    insertUser.run(name, email, hash, role, cls, div);
  }

  const s1 = userId('demo.student1@example.com');
  const s2 = userId('demo.student2@example.com');
  const prof = userId('demo.professor@example.com');

  const join = db.prepare('INSERT OR IGNORE INTO subject_participants (user_id, subject_id) VALUES (?, ?)');
  for (const code of ['DAA', 'CN', 'WT']) {
    join.run(s1, subjectId(code));
    join.run(prof, subjectId(code));
  }
  join.run(s2, subjectId('WT'));
  join.run(s2, subjectId('CN'));

  // Only add demo doubts once.
  const already = db.prepare('SELECT COUNT(*) AS n FROM doubts WHERE author_id IN (?, ?)').get(s1, s2).n;
  if (already > 0) return;

  const addDoubt = db.prepare(
    'INSERT INTO doubts (subject_id, author_id, title, description, status) VALUES (?, ?, ?, ?, ?)'
  );
  const addAnswer = db.prepare('INSERT INTO answers (doubt_id, author_id, body) VALUES (?, ?, ?)');

  addDoubt.run(subjectId('DAA'), s1, '[Demo] Why is merge sort O(n log n)?',
    'I understand that the array is split in half each time, but where does the extra "n" come from in the time complexity?',
    'unanswered');

  const cnDoubt = addDoubt.run(subjectId('CN'), s2, '[Demo] Difference between TCP and UDP?',
    'When should an application choose UDP over TCP? Examples would help.', 'answered').lastInsertRowid;
  addAnswer.run(cnDoubt, prof,
    'TCP is connection-oriented and reliable (ordered delivery, retransmission). UDP is connectionless and faster with less overhead, so it suits live video, gaming and DNS where speed matters more than perfect delivery.');

  db.prepare(
    "INSERT INTO notifications (user_id, actor_id, doubt_id, type, message) VALUES (?, ?, ?, 'professor_answer', ?)"
  ).run(s2, prof, cnDoubt, 'Professor Demo Professor responded to your doubt "[Demo] Difference between TCP and UDP?" in CN.');

  const wtDoubt = addDoubt.run(subjectId('WT'), s1, '[Demo] What does express.json() do?',
    'I see app.use(express.json()) in every Express tutorial. What happens if I remove it?', 'resolved').lastInsertRowid;
  addAnswer.run(wtDoubt, s2, 'It is middleware that parses JSON request bodies into req.body. Without it, req.body is undefined for JSON requests.');
  db.prepare("UPDATE doubts SET resolved_by = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(s1, wtDoubt);
})();

db.close();
console.log('Demo data added. Log in with any of these (password: Demo@1234):');
for (const [name, email, role] of demoUsers) console.log(`  ${role.padEnd(9)} ${email}  (${name})`);
