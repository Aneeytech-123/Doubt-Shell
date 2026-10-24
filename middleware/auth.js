/**
 * Authentication & authorization middleware.
 *
 * The session only stores the user's id. On every request we load the user
 * from the database, so the role / name / class shown in the app always comes
 * from the server — never from anything the browser sends.
 */

/** Runs on every request: puts the logged-in user (or null) on req.user. */
function loadUser(req, res, next) {
  req.user = null;
  const userId = req.session && req.session.userId;
  if (userId) {
    const user = req.app.locals.db
      .prepare(
        'SELECT id, full_name, email, role, class_name, division, status FROM users WHERE id = ?'
      )
      .get(userId);
    if (user && user.status === 'active') {
      req.user = user;
    } else {
      delete req.session.userId; // account deleted or no longer active
    }
  }
  next();
}

/** For JSON API routes: reply 401 if not logged in. */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

/** For HTML pages: redirect to the landing page if not logged in. */
function requirePageAuth(req, res, next) {
  if (!req.user) return res.redirect('/?login=required');
  next();
}

/** Allow only the given roles, e.g. requireRole('professor'). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

/** Only the public, safe fields of a user are ever sent to the browser. */
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    className: user.class_name,
    division: user.division,
  };
}

module.exports = { loadUser, requireAuth, requirePageAuth, requireRole, publicUser };
