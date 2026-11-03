const express = require('express');
const { createNotificationProxy } = require('./routes/notifi');
const { httpErrors } = require('../shared/httpErrors');

function createGatewayApp({ env = process.env, stockProxy } = {}) {
  const app = express();
  app.use('/notify', createNotificationProxy(env));
  app.use(express.json());
  if (stockProxy) app.use('/update-stock', stockProxy);
  app.use(httpErrors);
  return app;
}

module.exports = { createGatewayApp };
