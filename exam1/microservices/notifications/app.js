const express = require('express');
const { notificationAuth } = require('../../shared/notificationAuth');
const { observe } = require('../../shared/observability');

const LIMITS = Object.freeze({ subject: 200, text: 10000, recipients: 10 });
const addressPattern = /^[^\s@<>,;]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/;
const containsControl = value => Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

function validPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Object.keys(body).some(key => !['to', 'subject', 'text'].includes(key))) return false;
  if (typeof body.to !== 'string' || body.to.length > 2540 || containsControl(body.to)) return false;
  const recipients = body.to.split(',').map(address => address.trim());
  if (!recipients.length || recipients.length > LIMITS.recipients ||
      recipients.some(address => address.length > 254 || !addressPattern.test(address))) return false;
  return typeof body.subject === 'string' && body.subject.trim().length > 0 &&
    body.subject.length <= LIMITS.subject && !containsControl(body.subject) &&
    typeof body.text === 'string' && body.text.trim().length > 0 &&
    body.text.length <= LIMITS.text && !body.text.includes('\0');
}

function createNotificationApp({ env = process.env, transporter, logger = console,
  now = Date.now, rateLimit = { max: 60, windowMs: 60000 } } = {}) {
  const authenticate = notificationAuth(env);
  if (!transporter || typeof transporter.sendMail !== 'function') throw new Error('Transport de notification requis.');
  const app = express();
  app.disable('x-powered-by');
  observe(app, { service: 'notifications', logger });
  let startedAt = now();
  let attempts = 0;
  // One service identity, one bounded counter; denied calls do not consume quota.
  app.use('/notify', authenticate, (req, res, next) => {
    const current = now();
    if (current - startedAt >= rateLimit.windowMs) { startedAt = current; attempts = 0; }
    if (++attempts > rateLimit.max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((startedAt + rateLimit.windowMs - current) / 1000))));
      return res.status(429).json({ message: 'Limite de notifications atteinte.' });
    }
    next();
  });
  app.post('/notify', express.json({ limit: '32kb', strict: true }), async (req, res) => {
    if (!validPayload(req.body)) return res.status(400).json({ message: 'Champs to, subject et text invalides.' });
    const { to, subject, text } = req.body;
    try {
      await transporter.sendMail({ from: env.EMAIL_USER, to, subject, text,
        disableFileAccess: true, disableUrlAccess: true });
      return res.status(200).json({ message: 'Email envoyé avec succès.' });
    } catch {
      logger.error('Échec de l’envoi de notification.');
      return res.status(500).json({ message: 'Erreur lors de l’envoi de l’email.' });
    }
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : 400;
    return res.status(status).json({ message: status === 413 ? 'Requête trop volumineuse.' : 'Corps JSON invalide.' });
  });
  return app;
}

module.exports = { createNotificationApp };
