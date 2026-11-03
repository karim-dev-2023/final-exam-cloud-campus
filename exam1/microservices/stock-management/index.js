require('dotenv').config();
const Product = require('../../backend/models/Product');
const { createStockApp } = require('./app');
async function start() {
  const app = createStockApp();
  if (!process.env.MONGO_URI) throw new Error('Configuration MongoDB requise.');
  await Product.db.openUri(process.env.MONGO_URI);
  app.listen(process.env.STOCK_PORT || 4003, () => console.log('Service de gestion des stocks démarré.'));
}
if (require.main === module) start().catch(() => { console.error('Démarrage stock refusé : vérifier la configuration.'); process.exitCode = 1; });
module.exports = { start };
