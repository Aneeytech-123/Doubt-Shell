/**
 * Optional email sending with Nodemailer.
 * If SMTP_HOST is empty, emails are simply skipped — the rest of the app
 * (including in-app notifications) keeps working normally.
 */
const nodemailer = require('nodemailer');
const config = require('../config');

function createMailer(smtp = config.smtp) {
  if (!smtp.host) {
    return { enabled: false, async send() { return false; } };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  return {
    enabled: true,
    async send({ to, subject, text }) {
      try {
        await transporter.sendMail({ from: smtp.from, to, subject, text });
        return true;
      } catch (err) {
        // An email failure must never break the request that triggered it.
        console.error('[mailer] could not send email:', err.message);
        return false;
      }
    },
  };
}

module.exports = { createMailer };
