// server.js
const { createBackendApp } = require('./app');
require('dotenv').config();
const connectDB = require('./config/db');
const { startCheckoutRecovery } = require('./services/checkoutService');

const app = createBackendApp();
connectDB();
startCheckoutRecovery();


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur en écoute sur le port ${PORT}`));
