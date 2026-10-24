const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const h = require('./helpers');

describe('Unauthorized access prevention', () => {
  let ctx;
  before(() => { ctx = h.makeApp(); });

  test('private API routes return 401 when not logged in', async () => {
    const anon = request(ctx.app);
    for (const url of ['/api/subjects', '/api/subjects/CN', '/api/subjects/CN/doubts', '/api/doubts/1', '/api/notifications', '/api/notifications/unread-count']) {
      assert.equal((await anon.get(url)).status, 401, url);
    }
    const agent = await h.newAgent(ctx.app);
    assert.equal((await h.send(agent, 'post', '/api/subjects/CN/join')).status, 401);
    assert.equal((await h.postDoubt(agent, 'CN')).status, 401);
  });

  test('private pages redirect to the landing page when not logged in', async () => {
    const anon = request(ctx.app);
    for (const url of ['/dashboard', '/subjects/CN', '/notifications']) {
      const res = await anon.get(url);
      assert.equal(res.status, 302, url);
      assert.equal(res.headers.location, '/?login=required');
    }
  });

  test('state-changing requests without a CSRF token are rejected', async () => {
    const agent = await h.registerStudent(ctx.app);
    const res = await agent.post('/api/subjects/CN/join'); // no X-CSRF-Token header
    assert.equal(res.status, 403);
    const wrong = await agent.post('/api/subjects/CN/join').set('X-CSRF-Token', 'x'.repeat(64));
    assert.equal(wrong.status, 403);
  });

  test('session cookie is HttpOnly and SameSite, and security headers are set', async () => {
    const agent = await h.newAgent(ctx.app);
    const res = await h.send(agent, 'post', '/api/auth/register/student', {
      fullName: 'Cookie Check', className: 'FE', division: 'A', email: h.uniqueEmail('cookie'),
      password: h.PASSWORD, confirmPassword: h.PASSWORD,
    });
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /doubtbridge\.sid=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const page = await request(ctx.app).get('/');
    assert.match(page.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.headers['x-powered-by'], undefined);
  });

  test('malformed JSON gives a clean 400 error', async () => {
    const agent = await h.newAgent(ctx.app);
    const res = await agent.post('/api/auth/login').set('X-CSRF-Token', agent.csrf).set('Content-Type', 'application/json').send('{bad json');
    assert.equal(res.status, 400);
  });
});

describe('Navigation links', () => {
  test('every internal link in the HTML pages leads to a working page', async () => {
    const ctx = h.makeApp();
    const agent = await h.registerStudent(ctx.app);
    const viewsDir = path.join(__dirname, '..', 'views');
    const links = new Set();
    for (const file of fs.readdirSync(viewsDir)) {
      const html = fs.readFileSync(path.join(viewsDir, file), 'utf8');
      for (const m of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) links.add(m[1]);
    }
    assert.ok(links.size > 5);
    for (const link of links) {
      const res = await agent.get(link);
      // Logged-in users are redirected away from login/register pages (302) — that is expected
      assert.ok([200, 302].includes(res.status), `${link} returned ${res.status}`);
    }
    const anon = request(ctx.app);
    for (const link of ['/', '/login', '/login?role=student', '/login?role=professor', '/register/student', '/register/professor']) {
      assert.equal((await anon.get(link)).status, 200, link);
    }
    assert.equal((await agent.get('/subjects/NOPE')).status, 404);
  });
});
