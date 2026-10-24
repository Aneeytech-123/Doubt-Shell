const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const h = require('./helpers');

test('accounts, doubts and login sessions persist after restarting the server', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doubtbridge-test-'));
  const dbPath = path.join(dir, 'test.db');

  // --- first "server run" ---
  const first = h.makeApp({ dbPath });
  const email = h.uniqueEmail('persist');
  const start = await request(first.app).get('/api/session');
  let cookie = start.headers['set-cookie'][0].split(';')[0];
  const reg = await request(first.app)
    .post('/api/auth/register/student')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', start.body.csrfToken)
    .send({ fullName: 'Persistent Student', className: 'TE', division: 'A', email, password: h.PASSWORD, confirmPassword: h.PASSWORD });
  assert.equal(reg.status, 201);
  cookie = reg.headers['set-cookie'][0].split(';')[0]; // new session id after login
  const csrf = reg.body.csrfToken;

  await request(first.app).post('/api/subjects/CN/join').set('Cookie', cookie).set('X-CSRF-Token', csrf);
  const posted = await request(first.app)
    .post('/api/subjects/CN/doubts')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .send({ title: 'Does this survive a restart?', description: 'Checking that SQLite keeps the data on disk.' });
  assert.equal(posted.status, 201);
  first.db.close(); // "stop the server"

  // --- second "server run" with the same database file ---
  const second = h.makeApp({ dbPath });

  // The old cookie still works: sessions are stored in SQLite, not in memory.
  const me = await request(second.app).get('/api/session').set('Cookie', cookie);
  assert.equal(me.body.user.email, email);

  const doubts = await request(second.app).get('/api/subjects/CN/doubts').set('Cookie', cookie);
  assert.equal(doubts.body.doubts.length, 1);
  assert.equal(doubts.body.doubts[0].title, 'Does this survive a restart?');

  const room = await request(second.app).get('/api/subjects/CN').set('Cookie', cookie);
  assert.equal(room.body.participantCount, 1);

  // A fresh login also works with the stored password hash.
  const agent = await h.newAgent(second.app);
  const login = await h.send(agent, 'post', '/api/auth/login', { email, password: h.PASSWORD, role: 'student' });
  assert.equal(login.status, 200);

  second.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
