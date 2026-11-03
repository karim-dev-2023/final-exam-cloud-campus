const express = require('express');
const { notificationAuth } = require('../../shared/notificationAuth');
const { reserveCheckoutItem, CheckoutError } = require('../../backend/services/checkoutService');
const { observe } = require('../../shared/observability');

function createStockApp(env = process.env) {
  const app = express();
  observe(app, { service: 'stock-management', ready: () => require('../../backend/models/Product').db.readyState === 1 });
  app.use(notificationAuth(env));
  app.use(express.json({ limit: '16kb' }));
  app.post('/update-stock', async (req, res) => {
    try {
      const { checkoutId, productId, quantity } = req.body || {};
      const product = await reserveCheckoutItem(checkoutId, productId, quantity);
      return res.json({ message: 'Stock réservé.', productId: String(product._id), stock: product.stock });
    } catch (error) {
      return res.status(error instanceof CheckoutError ? error.status : 503).json({ message: error instanceof CheckoutError ? error.message : 'Stock indisponible.' });
    }
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Requête invalide.' });
  });
  return app;
}
module.exports = { createStockApp };
