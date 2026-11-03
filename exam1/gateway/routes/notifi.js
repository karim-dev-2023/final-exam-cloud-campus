const express = require('express');
const proxy = require('express-http-proxy');
const { notificationAuth } = require('../../shared/notificationAuth');

function createNotificationProxy(env = process.env) {
  const router = express.Router();
  // Never add a privileged token to an unauthenticated incoming request.
  router.use('/', notificationAuth(env), proxy(env.NOTIFI_SERVICE_URL, {
    proxyReqPathResolver: req => req.originalUrl,
    proxyErrorHandler: (error, res) => res.status(502).json({ message: 'Service de notification indisponible.' }),
    timeout: 10000,
  }));
  return router;
}

module.exports = { createNotificationProxy };
