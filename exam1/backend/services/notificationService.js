const axios = require('axios');
const { getNotificationToken } = require('../../shared/notificationAuth');

async function sendNotification(payload, { env = process.env, httpClient = axios } = {}) {
  const token = getNotificationToken(env);
  const baseUrl = env.NOTIFICATION_GATEWAY_URL || 'http://localhost:8000';
  return httpClient.post(`${baseUrl.replace(/\/$/, '')}/notify`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
    maxRedirects: 0,
  });
}

module.exports = { sendNotification };
