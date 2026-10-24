/**
 * HTML page routes. Pages are plain HTML files in /views; their JavaScript
 * (in /public/js) fetches data from the JSON API.
 * Private pages are protected here on the SERVER, so they cannot be opened
 * without logging in.
 */
const express = require('express');
const path = require('path');
const { requirePageAuth } = require('../middleware/auth');

const router = express.Router();
const view = (name) => path.join(__dirname, '..', 'views', `${name}.html`);

// Public pages
router.get('/', (req, res) => res.sendFile(view('index')));

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.sendFile(view('login'));
});

router.get('/register/student', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.sendFile(view('register-student'));
});

router.get('/register/professor', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.sendFile(view('register-professor'));
});

// Private pages — login required
router.get('/dashboard', requirePageAuth, (req, res) => res.sendFile(view('dashboard')));
router.get('/notifications', requirePageAuth, (req, res) => res.sendFile(view('notifications')));

router.get('/subjects/:code', requirePageAuth, (req, res, next) => {
  const exists = req.app.locals.db.prepare('SELECT 1 FROM subjects WHERE code = ?').get(req.params.code);
  if (!exists) return next(); // falls through to the 404 page
  res.sendFile(view('room'));
});

module.exports = router;
