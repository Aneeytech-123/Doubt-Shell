/**
 * Test helpers. Each test file builds a fresh app with an in-memory SQLite
 * database, so tests never touch your real data.
 */
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '1000';
delete process.env.SMTP_HOST;

const request = require('supertest');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { openDatabase, seedSubjects } = require('../database/db');
const { createApp } = require('../app');

const PASSWORD = 'Strong@123';

/** A fake mailer that records emails instead of sending them. */
function fakeMailer() {
  return { enabled: true, sent: [], async send(mail) { this.sent.push(mail); return true; } };
}

function makeApp({ dbPath = ':memory:', mailer = { enabled: false, async send() { return false; } } } = {}) {
  const db = openDatabase(dbPath);
  seedSubjects(db);
  const app = createApp({ db, mailer });
  return { app, db, mailer };
}

/** A supertest "agent" keeps cookies between requests, like a browser. */
async function newAgent(app) {
  const agent = request.agent(app);
  const res = await agent.get('/api/session');
  agent.csrf = res.body.csrfToken;
  return agent;
}

/** Sends a state-changing request with the CSRF header. */
async function send(agent, method, url, body) {
  const res = await agent[method](url).set('X-CSRF-Token', agent.csrf).send(body);
  if (res.body && res.body.csrfToken) agent.csrf = res.body.csrfToken;
  return res;
}

let counter = 0;
const uniqueEmail = (prefix) => `${prefix}${++counter}@example.com`;

async function registerStudent(app, overrides = {}) {
  const agent = await newAgent(app);
  const body = {
    fullName: 'Test Student',
    className: 'TE',
    division: 'A',
    email: uniqueEmail('student'),
    password: PASSWORD,
    confirmPassword: PASSWORD,
    ...overrides,
  };
  const res = await send(agent, 'post', '/api/auth/register/student', body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  agent.user = res.body.user;
  return agent;
}

/** Creates an already-approved professor directly in the DB, then logs in. */
async function loginProfessor(app, db, name = 'Test Professor') {
  const email = uniqueEmail('prof');
  db.prepare(
    "INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, 'professor', 'active')"
  ).run(name, email, bcrypt.hashSync(PASSWORD, 4));
  const agent = await newAgent(app);
  const res = await send(agent, 'post', '/api/auth/login', { email, password: PASSWORD, role: 'professor' });
  if (res.status !== 200) throw new Error(`professor login failed: ${res.status}`);
  agent.user = res.body.user;
  return agent;
}

async function join(agent, code) {
  return send(agent, 'post', `/api/subjects/${code}/join`);
}

async function postDoubt(agent, code, overrides = {}) {
  return send(agent, 'post', `/api/subjects/${code}/doubts`, {
    title: 'How does this concept work?',
    description: 'I read the notes twice but I still do not understand it.',
    ...overrides,
  });
}

module.exports = {
  PASSWORD, config, fakeMailer, makeApp, newAgent, send, uniqueEmail,
  registerStudent, loginProfessor, join, postDoubt,
};
