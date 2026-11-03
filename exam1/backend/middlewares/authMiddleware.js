const jwt = require('jsonwebtoken');
exports.authenticateToken = (req, res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ message: 'Authentification requise.' });
  try {
    const user = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!user || typeof user.userId !== 'string' || !/^[a-f\d]{24}$/i.test(user.userId) ||
        !['admin', 'user'].includes(user.role) || !Number.isFinite(user.exp)) throw new Error('Invalid identity');
    req.user = user;
    return next();
  } catch {
    return res.status(403).json({ message: 'Token invalide.' });
  }
};
exports.isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Accès interdit.' });
  return next();
};
