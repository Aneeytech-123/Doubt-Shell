/**
 * Authentication routes: session info, registration, login and logout.
 *
 * The role is decided by the SERVER:
 *  - /register/student always creates a student, /register/professor a professor.
 *  - At login, the chosen portal (student or professor) must match the role
 *    stored in the database. Editing JavaScript in the browser cannot change it.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { publicUser } = require('../middleware/auth');
const { ensureCsrfToken } = require('../middleware/csrf');
const { HttpError } = require('../middleware/errors');
const { clean, validateRegistration, hasErrors } = require('../utils/validate');
const { isUniqueViolation } = require('../database/db');

// Used so a login for an unknown email takes as long as one for a real email
// (prevents attackers from discovering which emails are registered).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 4);

/** Replace the session id after login to prevent "session fixation" attacks. */
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      const csrfToken = ensureCsrfToken(req);
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve(csrfToken)));
    });
  });
}

function createAuthRouter() {
  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
  });

  // Current user + CSRF token for the page's JavaScript
  router.get('/session', (req, res) => {
    res.json({
      user: publicUser(req.user),
      csrfToken: ensureCsrfToken(req),
      professorPolicy: config.professorPolicy,
      classOptions: config.classOptions,
      divisionOptions: config.divisionOptions,
    });
  });

  async function register(req, res, role) {
    const db = req.app.locals.db;

    if (role === 'professor' && config.professorPolicy === 'closed') {
      throw new HttpError(403, 'Professor self-registration is disabled. Please contact the administrator.');
    }

    const { data, errors } = validateRegistration(req.body || {}, role);
    if (hasErrors(errors)) throw new HttpError(400, 'Please fix the highlighted fields.', errors);

    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(data.email);
    if (exists) {
      throw new HttpError(409, 'An account with this email already exists.', {
        email: 'This email is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(data.password, config.bcryptRounds);
    const status = role === 'professor' && config.professorPolicy === 'approval' ? 'pending' : 'active';

    let userId;
    try {
      userId = db
        .prepare(
          `INSERT INTO users (full_name, email, password_hash, role, class_name, division, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.fullName,
          data.email,
          passwordHash,
          role,
          role === 'student' ? data.className : null,
          role === 'student' ? data.division : null,
          status
        ).lastInsertRowid;
    } catch (err) {
      // Two requests with the same email at the same moment
      if (isUniqueViolation(err)) {
        throw new HttpError(409, 'An account with this email already exists.', {
          email: 'This email is already registered.',
        });
      }
      throw err;
    }

    if (status === 'pending') {
      return res.status(201).json({
        status: 'pending',
        message: 'Registration received. An administrator must approve your professor account before you can log in.',
      });
    }

    const csrfToken = await startSession(req, userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ status: 'active', user: publicUser(user), csrfToken });
  }

  router.post('/auth/register/student', authLimiter, (req, res) => register(req, res, 'student'));
  router.post('/auth/register/professor', authLimiter, (req, res) => register(req, res, 'professor'));

  router.post('/auth/login', authLimiter, async (req, res) => {
    const db = req.app.locals.db;
    const body = req.body || {};
    const email = clean(body.email).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const role = clean(body.role);

    if (!['student', 'professor'].includes(role)) {
      throw new HttpError(400, 'Please choose Student Login or Professor Login first.');
    }
    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required.');
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !passwordOk) {
      throw new HttpError(401, 'Incorrect email or password.');
    }

    if (user.role !== role) {
      const correct = user.role === 'professor' ? 'Professor Login' : 'Student Login';
      throw new HttpError(403, `This is a ${user.role} account. Please use ${correct}.`);
    }
    if (user.status === 'pending') {
      throw new HttpError(403, 'Your professor account is waiting for administrator approval.');
    }
    if (user.status !== 'active') {
      throw new HttpError(403, 'This account is not active. Please contact the administrator.');
    }

    const csrfToken = await startSession(req, user.id);
    res.json({ user: publicUser(user), csrfToken });
  });

  router.post('/auth/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('doubtbridge.sid');
      res.json({ ok: true });
    });
  });

  return router;
}

module.exports = createAuthRouter;
