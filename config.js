/**
 * config.js — reads settings from environment variables (.env file)
 * and exposes them to the rest of the app in one place.
 */
require('dotenv').config({ quiet: true });
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

let sessionSecret = process.env.SESSION_SECRET;
let usingTemporarySecret = false;
if (!sessionSecret || sessionSecret === 'replace-with-a-long-random-string') {
  if (isProduction) {
    throw new Error('SESSION_SECRET must be set in production. See .env.example');
  }
  // Development fallback: a random secret (sessions reset when the server restarts).
  sessionSecret = crypto.randomBytes(32).toString('hex');
  usingTemporarySecret = true;
}

const allowedPolicies = ['approval', 'open', 'closed'];
let professorPolicy = (process.env.PROFESSOR_REGISTRATION || 'approval').toLowerCase();
if (!allowedPolicies.includes(professorPolicy)) professorPolicy = 'approval';

module.exports = {
  port: Number(process.env.PORT) || 3000,
  isProduction,
  isTest,
  sessionSecret,
  usingTemporarySecret,
  dbPath: process.env.DB_PATH || './data/doubtbridge.db',
  professorPolicy,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  bcryptRounds: isTest ? 4 : 12, // fewer rounds only to make automated tests fast
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Allowed values for student registration (edit to match your college)
  classOptions: ['FE', 'SE', 'TE', 'BE'],
  divisionOptions: ['A', 'B', 'C', 'D', 'E', 'F'],

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'DoubtBridge <no-reply@example.com>',
  },
};
