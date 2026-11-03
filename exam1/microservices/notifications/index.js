const nodemailer = require('nodemailer');
const { createNotificationApp } = require('./app');
const { getNotificationToken } = require('../../shared/notificationAuth');

function startNotifications({ env = process.env, logger = console,
  createTransport = nodemailer.createTransport } = {}) {
  getNotificationToken(env);
  const transporter = createTransport({
    service: 'gmail',
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_APPLICATION_PASSWORD },
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    logger: false,
    debug: false,
  });
  const app = createNotificationApp({ env, transporter, logger });
  const server = app.listen(env.NOTIFI_PORT ?? 4002, () => {
    logger.log('Service de notification démarré.');
  });
  return { app, server, transporter };
}

if (require.main === module) {
  require('dotenv').config();
  try { startNotifications(); }
  catch { console.error('Démarrage notifications refusé : vérifier NOTIFICATION_SERVICE_TOKEN.'); process.exitCode = 1; }
}

module.exports = { startNotifications };
