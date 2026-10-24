/**
 * app.js — builds the Express application.
 *
 * Request flow:
 *   browser -> helmet (security headers) -> JSON body parser -> session
 *           -> loadUser -> CSRF check -> route -> JSON / HTML response
 *
 * The app is created by a function so tests can create a fresh copy
 * with an in-memory database.
 */
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const config = require('./config');
const SQLiteSessionStore = require('./database/sessionStore');
const { createMailer } = require('./services/mailer');
const { loadUser } = require('./middleware/auth');
const { verifyCsrf } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errors');

const createAuthRouter = require('./routes/auth');
const subjectRoutes = require('./routes/subjects');
const doubtRoutes = require('./routes/doubts');
const notificationRoutes = require('./routes/notifications');
const pageRoutes = require('./routes/pages');

function createApp({ db, mailer = createMailer() }) {
  const app = express();
  app.locals.db = db;
  app.locals.mailer = mailer;

  if (config.isProduction) app.set('trust proxy', 1); // needed behind Render/Railway HTTPS proxies
  app.disable('x-powered-by');

  // Security headers, including a Content-Security-Policy that only allows
  // scripts from our own server (blocks injected <script> tags).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
        },
      },
    })
  );

  app.use(express.json({ limit: '20kb' }));

  app.use(
    session({
      name: 'doubtbridge.sid',
      secret: config.sessionSecret,
      store: new SQLiteSessionStore(db),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,                 // JavaScript in the page cannot read the cookie
        sameSite: 'lax',                // not sent on cross-site POST requests
        secure: config.isProduction,    // HTTPS-only when deployed
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      },
    })
  );

  app.use(loadUser);

  // ---------- JSON API ----------
  app.use('/api', verifyCsrf);
  app.use('/api', createAuthRouter());
  app.use('/api/subjects', subjectRoutes);
  app.use('/api/doubts', doubtRoutes);
  app.use('/api/notifications', notificationRoutes);

  // ---------- HTML pages & static files ----------
  app.use(pageRoutes);
  app.use(express.static(path.join(__dirname, 'public'), { index: false }));
  app.get('/vendor/lucide.min.js', (req, res) =>
    res.sendFile(path.join(__dirname, 'node_modules', 'lucide', 'dist', 'umd', 'lucide.min.js'))
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
