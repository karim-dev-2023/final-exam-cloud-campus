const express = require('express');
const cors = require('cors');
const { httpErrors } = require('../shared/httpErrors');
const { loginLimit } = require('./middlewares/loginLimit');

function createBackendApp({ env = process.env, authLimit = {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const origins = (env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(x => x.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, done) => done(null, !origin || origins.includes(origin)) }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/auth', loginLimit(authLimit));
  app.use('/api/products', require('./routes/productRoutes'));
  app.use('/api/orders', require('./routes/orderRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use(httpErrors);
  return app;
}

module.exports = { createBackendApp };
