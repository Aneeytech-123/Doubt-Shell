/**
 * Server-side validation helpers.
 * The browser also validates forms, but browser checks can be bypassed,
 * so the server checks everything again before touching the database.
 */
const config = require('../config');

/** Turn any value into a trimmed string ('' for missing values). */
function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}][\p{L} .'-]*$/u;

function validateEmail(email, errors) {
  if (!email) errors.email = 'Email is required.';
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
}

function validateName(name, errors) {
  if (!name) errors.fullName = 'Full name is required.';
  else if (name.length < 2 || name.length > 80) errors.fullName = 'Name must be 2–80 characters.';
  else if (!NAME_RE.test(name)) errors.fullName = 'Name may only contain letters, spaces, dots, hyphens and apostrophes.';
}

/** Strength rule: 8–72 characters with uppercase, lowercase and a number. */
function passwordProblem(password) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be at most 72 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include an uppercase letter, a lowercase letter and a number.';
  }
  return null;
}

function validateRegistration(body, role) {
  const errors = {};
  const data = {
    fullName: clean(body.fullName).replace(/\s+/g, ' '),
    email: clean(body.email).toLowerCase(),
    password: typeof body.password === 'string' ? body.password : '',
    confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
  };

  validateName(data.fullName, errors);
  validateEmail(data.email, errors);
  const pwProblem = passwordProblem(data.password);
  if (pwProblem) errors.password = pwProblem;
  if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  if (role === 'student') {
    data.className = clean(body.className).toUpperCase();
    data.division = clean(body.division).toUpperCase();
    if (!config.classOptions.includes(data.className)) errors.className = 'Select your class.';
    if (!config.divisionOptions.includes(data.division)) errors.division = 'Select your division.';
  }

  return { data, errors };
}

function validateDoubt(body) {
  const errors = {};
  const title = clean(body.title).replace(/\s+/g, ' ');
  const description = clean(body.description);
  if (title.length < 8 || title.length > 150) errors.title = 'Title must be 8–150 characters.';
  if (description.length < 15 || description.length > 5000) {
    errors.description = 'Description must be 15–5000 characters.';
  }
  return { data: { title, description }, errors };
}

function validateAnswer(body) {
  const errors = {};
  const text = clean(body.body);
  if (text.length < 2 || text.length > 5000) errors.body = 'Answer must be 2–5000 characters.';
  return { data: { body: text }, errors };
}

/** Converts "12" -> 12, anything invalid -> null. */
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const hasErrors = (errors) => Object.keys(errors).length > 0;

module.exports = {
  clean,
  passwordProblem,
  validateRegistration,
  validateDoubt,
  validateAnswer,
  toId,
  hasErrors,
};
