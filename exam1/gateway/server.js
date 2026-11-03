require('dotenv').config();
const { createGatewayApp } = require('./app');

try {
  const app = createGatewayApp({ stockProxy: require('./routes/stock') });
  const PORT = process.env.GATEWAY_PORT || 8000;
  app.listen(PORT, () => console.log(`Gateway opérationnel sur le port ${PORT}`));
} catch {
  console.error('Démarrage Gateway refusé : vérifier la configuration des services et NOTIFICATION_SERVICE_TOKEN.');
  process.exitCode = 1;
}
