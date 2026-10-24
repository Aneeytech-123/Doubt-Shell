/**
 * CSRF protection (synchronizer-token pattern).
 *
 * 1. The server stores a random token in the user's session.
 * 2. The page fetches it from GET /api/session and sends it back in the
 *    "X-CSRF-Token" header with every POST / PATCH / DELETE request.
 * 3. A malicious site can make the browser send our cookie, but it cannot
 *    read our token — so its forged request is rejected with 403.
 */
const crypto = require('crypto');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.includes(req.method)) return next();

  const sent = req.get('X-CSRF-Token') || '';
  const expected = req.session && req.session.csrfToken;
  const valid =
    expected &&
    sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));

  if (!valid) {
    return res.status(403).json({ error: 'Your session expired. Please refresh the page and try again.' });
  }
  next();
}

module.exports = { ensureCsrfToken, verifyCsrf };
