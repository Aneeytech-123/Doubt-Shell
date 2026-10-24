const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('Student registration and login', () => {
  let ctx;
  beforeEach(() => { ctx = h.makeApp(); });

  test('a student can register and is logged in immediately', async () => {
    const agent = await h.registerStudent(ctx.app, { fullName: 'Asha Patil', className: 'te', division: 'b' });
    assert.equal(agent.user.role, 'student');
    assert.equal(agent.user.className, 'TE');
    assert.equal(agent.user.division, 'B');

    const me = await agent.get('/api/session');
    assert.equal(me.body.user.fullName, 'Asha Patil');
  });

  test('the password is stored as a bcrypt hash and never returned', async () => {
    const agent = await h.registerStudent(ctx.app);
    const row = ctx.db.prepare('SELECT password_hash FROM users WHERE id = ?').get(agent.user.id);
    assert.match(row.password_hash, /^\$2[aby]\$/);
    assert.notEqual(row.password_hash, h.PASSWORD);
    assert.equal(agent.user.password, undefined);
    assert.equal(agent.user.password_hash, undefined);
    assert.equal(agent.user.passwordHash, undefined);
  });

  test('a registered student can log out and log in again', async () => {
    const email = h.uniqueEmail('login');
    const agent = await h.registerStudent(ctx.app, { email });
    const out = await h.send(agent, 'post', '/api/auth/logout');
    assert.equal(out.status, 200);
    assert.equal((await agent.get('/api/session')).body.user, null);

    const fresh = await h.newAgent(ctx.app);
    const res = await h.send(fresh, 'post', '/api/auth/login', { email: email.toUpperCase(), password: h.PASSWORD, role: 'student' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
  });

  test('wrong password gives a generic error', async () => {
    const email = h.uniqueEmail('wrong');
    await h.registerStudent(ctx.app, { email });
    const agent = await h.newAgent(ctx.app);
    const res = await h.send(agent, 'post', '/api/auth/login', { email, password: 'Wrong@1234', role: 'student' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Incorrect email or password.');

    const unknown = await h.send(agent, 'post', '/api/auth/login', { email: 'nobody@example.com', password: 'Wrong@1234', role: 'student' });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.error, res.body.error);
  });

  test('registration validates required fields, email, password strength and class', async () => {
    const agent = await h.newAgent(ctx.app);
    const res = await h.send(agent, 'post', '/api/auth/register/student', {
      fullName: '', email: 'not-an-email', password: 'weak', confirmPassword: 'other', className: 'XYZ', division: '',
    });
    assert.equal(res.status, 400);
    for (const field of ['fullName', 'email', 'password', 'confirmPassword', 'className', 'division']) {
      assert.ok(res.body.details[field], `expected an error for ${field}`);
    }
  });

  test('duplicate email is rejected (case-insensitive)', async () => {
    const email = h.uniqueEmail('dup');
    await h.registerStudent(ctx.app, { email });
    const agent = await h.newAgent(ctx.app);
    const res = await h.send(agent, 'post', '/api/auth/register/student', {
      fullName: 'Someone Else', className: 'SE', division: 'C', email: email.toUpperCase(),
      password: h.PASSWORD, confirmPassword: h.PASSWORD,
    });
    assert.equal(res.status, 409);
    assert.ok(res.body.details.email);
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get(email).n, 1);
  });

  test('extra fields like role cannot turn a student into a professor', async () => {
    const agent = await h.registerStudent(ctx.app, { role: 'professor', status: 'active' });
    assert.equal(agent.user.role, 'student');
    const row = ctx.db.prepare('SELECT role FROM users WHERE id = ?').get(agent.user.id);
    assert.equal(row.role, 'student');
  });
});

describe('Professor login and role authorization', () => {
  let ctx;
  beforeEach(() => { ctx = h.makeApp(); h.config.professorPolicy = 'approval'; });

  test('with the approval policy a new professor is pending and cannot log in until approved', async () => {
    const email = h.uniqueEmail('newprof');
    const agent = await h.newAgent(ctx.app);
    const reg = await h.send(agent, 'post', '/api/auth/register/professor', {
      fullName: 'Dr Meera Joshi', email, password: h.PASSWORD, confirmPassword: h.PASSWORD,
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.status, 'pending');
    assert.equal(reg.body.user, undefined);

    const blocked = await h.send(agent, 'post', '/api/auth/login', { email, password: h.PASSWORD, role: 'professor' });
    assert.equal(blocked.status, 403);
    assert.match(blocked.body.error, /approval/i);

    // Administrator approves (same SQL as scripts/professors.js)
    ctx.db.prepare("UPDATE users SET status = 'active' WHERE email = ?").run(email);
    const ok = await h.send(agent, 'post', '/api/auth/login', { email, password: h.PASSWORD, role: 'professor' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.role, 'professor');
    assert.equal(ok.body.user.className, null);
  });

  test('closed policy blocks professor registration; open policy activates immediately', async () => {
    const agent = await h.newAgent(ctx.app);
    const body = (email) => ({ fullName: 'Dr Test', email, password: h.PASSWORD, confirmPassword: h.PASSWORD });

    h.config.professorPolicy = 'closed';
    const closed = await h.send(agent, 'post', '/api/auth/register/professor', body(h.uniqueEmail('closed')));
    assert.equal(closed.status, 403);

    h.config.professorPolicy = 'open';
    const open = await h.send(agent, 'post', '/api/auth/register/professor', body(h.uniqueEmail('open')));
    assert.equal(open.status, 201);
    assert.equal(open.body.status, 'active');
    h.config.professorPolicy = 'approval';
  });

  test('a professor cannot use the student login and a student cannot use the professor login', async () => {
    const prof = await h.loginProfessor(ctx.app, ctx.db);
    const studentEmail = h.uniqueEmail('stu');
    await h.registerStudent(ctx.app, { email: studentEmail });

    const agent = await h.newAgent(ctx.app);
    const a = await h.send(agent, 'post', '/api/auth/login', { email: prof.user.email, password: h.PASSWORD, role: 'student' });
    assert.equal(a.status, 403);
    assert.match(a.body.error, /Professor Login/);

    const b = await h.send(agent, 'post', '/api/auth/login', { email: studentEmail, password: h.PASSWORD, role: 'professor' });
    assert.equal(b.status, 403);
    assert.match(b.body.error, /Student Login/);

    const c = await h.send(agent, 'post', '/api/auth/login', { email: studentEmail, password: h.PASSWORD, role: 'admin' });
    assert.equal(c.status, 400);
  });

  test('only professors (or the author) can resolve other people\'s doubts', async () => {
    const student = await h.registerStudent(ctx.app);
    const other = await h.registerStudent(ctx.app);
    const prof = await h.loginProfessor(ctx.app, ctx.db);
    await h.join(student, 'DAA');
    const { body } = await h.postDoubt(student, 'DAA');

    const denied = await h.send(other, 'patch', `/api/doubts/${body.doubt.id}/resolve`, { resolved: true });
    assert.equal(denied.status, 403);

    const allowed = await h.send(prof, 'patch', `/api/doubts/${body.doubt.id}/resolve`, { resolved: true });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.doubt.status, 'resolved');
  });
});

describe('Rate limiting', () => {
  test('too many login attempts are blocked with 429', async () => {
    const original = h.config.authRateLimitMax;
    h.config.authRateLimitMax = 3;
    const ctx = h.makeApp(); // limiter is created with the lower limit
    h.config.authRateLimitMax = original;

    const agent = await h.newAgent(ctx.app);
    const attempt = () => h.send(agent, 'post', '/api/auth/login', { email: 'x@example.com', password: 'Wrong@123', role: 'student' });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error, /Too many attempts/);
  });
});
