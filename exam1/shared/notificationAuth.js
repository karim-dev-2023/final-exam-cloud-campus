const { createHash, timingSafeEqual } = require('node:crypto');

function getNotificationToken(env = process.env) {
  const token = env.NOTIFICATION_SERVICE_TOKEN;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new Error('NOTIFICATION_SERVICE_TOKEN doit contenir un secret aléatoire de 43 à 128 caractères base64url.');
  }
  return token;
}

function notificationAuth(env = process.env) {
  const expected = createHash('sha256').update(getNotificationToken(env)).digest();
  return (req, res, next) => {
    const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(req.get('authorization') || '');
    const supplied = createHash('sha256').update(match ? match[1] : '').digest();
    if (!timingSafeEqual(expected, supplied) || !match) {
      return res.status(401).json({ message: 'Authentification interservices requise.' });
    }
    next();
  };
}

module.exports = { getNotificationToken, notificationAuth };
