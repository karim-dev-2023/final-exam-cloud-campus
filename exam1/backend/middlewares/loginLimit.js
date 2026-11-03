const crypto = require('node:crypto');

// Per-process buckets. Multiple instances require a shared edge/store.
function loginLimit({ max = 30, windowMs = 60000, now = Date.now } = {}) {
  const sources = new Map(), accounts = new Map();
  function bucket(map, key, time) {
    if (map.size >= 10000) {
      for (const [id, value] of map) if (value.until <= time) map.delete(id);
      if (map.size >= 10000 && !map.has(key)) return null;
    }
    let value = map.get(key);
    if (!value || value.until <= time) { value = { count: 0, until: time + windowMs }; map.set(key, value); }
    return value;
  }
  return (req, res, next) => {
    const time = now();
    const identity = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const key = crypto.createHash('sha256').update(identity).digest('hex');
    const source = bucket(sources, req.ip, time), account = bucket(accounts, key, time);
    if (!source || !account || source.count >= max || account.count >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ message: 'Trop de tentatives. Réessayez plus tard.' });
    }
    source.count++; account.count++;
    next();
  };
}
module.exports = { loginLimit };
