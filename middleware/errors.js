/**
 * Central error handling. Express 5 automatically forwards errors thrown
 * inside route handlers here, so routes do not need try/catch everywhere.
 */
const path = require('path');

/** Throw `new HttpError(400, 'message')` from a route to send a clean error. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFound(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, '..', 'views', '404.html'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON body sent by the browser
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('[server error]', err); // full details only in the server log
  }

  const message = status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message;
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: message, details: err.details });
  }
  res.status(status).send(message);
}

module.exports = { HttpError, notFound, errorHandler };
