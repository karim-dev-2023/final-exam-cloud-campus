const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('../backend/node_modules/express');
const { observe } = require('../shared/observability');
const { createBackendApp } = require('../backend/app');
const { createGatewayApp } = require('../gateway/app');
const { createStockApp } = require('../microservices/stock-management/app');
const { createNotificationApp } = require('../microservices/notifications/app');

async function withServer(app, check) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await check(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const env = { NOTIFICATION_SERVICE_TOKEN: 'a'.repeat(43), NOTIFI_SERVICE_URL: 'http://127.0.0.1:1' };
for (const [service, create] of [
  ['backend', () => createBackendApp()],
  ['gateway', () => createGatewayApp({ env })],
  ['stock-management', () => createStockApp(env)],
  ['notifications', () => createNotificationApp({ env, transporter: { sendMail() { throw new Error('must not send'); } } })],
]) {
  test(`${service}: health is public, minimal and independent of external services`, async () => {
    await withServer(create(), async base => {
      const response = await fetch(`${base}/health`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { status: 'ok', service });
      if (service === 'backend' || service === 'stock-management') {
        const ready = await fetch(`${base}/ready`);
        assert.equal(ready.status, 503); // No database is connected by these tests.
        assert.deepEqual(await ready.json(), { status: 'unavailable', service });
      }
    });
  });
}
test('readiness reflects dependency state and safely handles a failed check', async () => {
  let available = true;
  const app = express();
  observe(app, { service: 'test', ready: () => { if (available === null) throw new Error('private'); return available; } });
  await withServer(app, async base => {
    assert.equal((await fetch(`${base}/ready`)).status, 200);
    for (available of [false, null]) {
      const response = await fetch(`${base}/ready`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { status: 'unavailable', service: 'test' });
    }
  });
});
test('logs capture status and duration without URL, credentials or body; probes are quiet', async () => {
  const logs = [];
  const app = express();
  observe(app, { service: 'test', logger: { log: line => logs.push(line), error: line => logs.push(line) } });
  app.use(express.json());
  app.post('/private/:id', (req, res) => res.status(503).json({ preserved: true }));
  await withServer(app, async base => {
    await fetch(`${base}/health`);
    assert.equal(logs.length, 0);
    const response = await fetch(`${base}/private/secret-id?token=private-query`, { method: 'POST',
      headers: { Authorization: 'Bearer private-header', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'private-body' }) });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { preserved: true });
    assert.equal(logs.length, 1);
    const record = JSON.parse(logs[0]);
    assert.equal(record.level, 'error'); assert.equal(record.status, 503);
    assert.equal(record.method, 'POST'); assert.ok(record.durationMs >= 0);
    assert.ok(!logs[0].includes('private')); assert.ok(!logs[0].includes('secret-id'));
    assert.deepEqual(Object.keys(record).sort(), ['timestamp', 'level', 'event', 'service', 'method', 'status', 'durationMs'].sort());
  });
});
test('logger failures preserve the response and malformed JSON keeps its status', async () => {
  const app = express();
  observe(app, { service: 'test', logger: { log() { throw new Error('logger unavailable'); } } });
  app.use(express.json());
  app.post('/test', (req, res) => res.json({ ok: true }));
  app.use(require('../shared/httpErrors').httpErrors);
  await withServer(app, async base => {
    assert.equal((await fetch(`${base}/test`, { method: 'POST' })).status, 200);
    const malformed = await fetch(`${base}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  });
});
