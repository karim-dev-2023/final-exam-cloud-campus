// gateway/routes/stock.js
const express = require('express');
const proxy = require('express-http-proxy');
const { notificationAuth } = require('../../shared/notificationAuth');
require('dotenv').config();
const router = express.Router();

const STOCK_SERVICE_URL = process.env.STOCK_SERVICE_URL;

router.use('/', notificationAuth(), proxy(STOCK_SERVICE_URL, {
  proxyReqPathResolver: (req) => req.originalUrl,
  timeout: 10000,
  proxyErrorHandler: (error, res) => res.status(502).json({ message: 'Service de stock indisponible.' }),
}));

module.exports = router;
