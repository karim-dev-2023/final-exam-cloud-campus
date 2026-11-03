// No headers, URL, query, body, user identity or error detail enters these logs.
function observe(app, { service, logger = console, ready } = {}) {
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/ready') return next();
    const started = process.hrtime.bigint();
    res.once('finish', () => {
      try {
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        const write = level === 'error' ? logger.error : logger.log;
        if (typeof write === 'function') write.call(logger, JSON.stringify({
          timestamp: new Date().toISOString(), level, event: 'http_response', service,
          method: req.method, status: res.statusCode,
          durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
        }));
      } catch { /* Logging must never affect an HTTP response. */ }
    });
    next();
  });
  app.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', service });
  });
  if (ready) app.get('/ready', (req, res) => {
    let available = false;
    try { available = ready() === true; } catch { /* No internal error details. */ }
    res.set('Cache-Control', 'no-store').status(available ? 200 : 503)
      .json({ status: available ? 'ready' : 'unavailable', service });
  });
}
module.exports = { observe };
