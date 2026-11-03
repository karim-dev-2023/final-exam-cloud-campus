const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const serviceRequire = createRequire(path.join(root, 'microservices/notifications/package.json'));
const backendRequire = createRequire(path.join(root, 'backend/package.json'));
const gatewayRequire = createRequire(path.join(root, 'gateway/package.json'));
const nodemailer = serviceRequire('nodemailer');
const { createNotificationApp } = require('../microservices/notifications/app');
const { startNotifications } = require('../microservices/notifications');
const { createGatewayApp } = require('../gateway/app');
const { sendNotification } = require('../backend/services/notificationService');
const { getNotificationToken } = require('../shared/notificationAuth');

// No real environment secret, production database or SMTP transport is used.
const env = {
  NOTIFICATION_SERVICE_TOKEN: randomBytes(32).toString('base64url'),
  EMAIL_USER: 'sender@example.invalid',
  EMAIL_APPLICATION_PASSWORD: randomBytes(32).toString('base64url'),
  NOTIFI_PORT: 0,
};
const auth = { Authorization: `Bearer ${env.NOTIFICATION_SERVICE_TOKEN}` };
const payload = { to: 'recipient@example.invalid', subject: 'Commande de test', text: 'Bonjour\nCommande factice.' };
const quiet = { log() {}, error() {} };
const servers = [];
const transports = [];
const messages = [];
let notificationUrl, gatewayUrl, fixtureDir;

async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
function memoryTransport() {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true,
    disableFileAccess: true, disableUrlAccess: true });
  transports.push(transport);
  return { async sendMail(options) {
    const message = await transport.sendMail(options);
    messages.push({ options, mime: message.message.toString() });
    return message;
  } };
}
async function post(base, body, headers = auth) {
  return fetch(`${base}/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
}

before(async () => {
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e27-notifications-'));
  notificationUrl = await listen(createNotificationApp({ env, transporter: memoryTransport(), logger: quiet }));
  const express = gatewayRequire('express');
  const proxy = gatewayRequire('express-http-proxy');
  const stock = express();
  stock.use(express.json());
  stock.post('/update-stock', (req, res) => res.json({ received: req.body }));
  const stockUrl = await listen(stock);
  const stockProxy = proxy(stockUrl, { proxyReqPathResolver: req => req.originalUrl });
  gatewayUrl = await listen(createGatewayApp({ env: { ...env, NOTIFI_SERVICE_URL: notificationUrl }, stockProxy }));
});

after(async () => {
  for (const server of servers.reverse()) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  for (const transport of transports) transport.close();
  // Remove only the two known synthetic files and their empty private directory.
  for (const name of ['canary.txt']) {
    const file = path.join(fixtureDir, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.rmdirSync(fixtureDir);
});

test('P0-01: real startup does not log credentials; SMTP debugging is disabled', async () => {
  const logs = [];
  let options;
  const started = startNotifications({ env, logger: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    createTransport(config) { options = config; return memoryTransport(); } });
  servers.push(started.server);
  await once(started.server, 'listening');
  const output = JSON.stringify(logs);
  assert.equal(logs.length, 1);
  for (const secret of [env.EMAIL_USER, env.EMAIL_APPLICATION_PASSWORD, env.NOTIFICATION_SERVICE_TOKEN]) {
    assert.equal(output.includes(secret), false);
  }
  assert.equal(options.logger, false);
  assert.equal(options.debug, false);
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
});

test('P1-03: missing/short service configuration fails closed before startup', () => {
  for (const token of [undefined, '', 'short', ' '.repeat(43)]) {
    const bad = { ...env, NOTIFICATION_SERVICE_TOKEN: token };
    assert.throws(() => getNotificationToken(bad));
    assert.throws(() => createNotificationApp({ env: bad, transporter: memoryTransport() }));
    assert.throws(() => createGatewayApp({ env: bad }));
    let created = false;
    assert.throws(() => startNotifications({ env: bad, createTransport() { created = true; } }));
    assert.equal(created, false);
  }
});

test('P1-03: service and Gateway reject unauthorized requests without mail generation', async t => {
  for (const [name, base] of [['direct', notificationUrl], ['gateway', gatewayUrl]]) {
    for (const [type, headers] of [
      ['missing', {}], ['wrong service token', { Authorization: `Bearer ${randomBytes(32).toString('base64url')}` }],
      ['user JWT', { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.synthetic.signature' }],
      ['wrong scheme', { Authorization: `Basic ${env.NOTIFICATION_SERVICE_TOKEN}` }],
    ]) await t.test(`${name}: ${type} -> 401`, async () => {
      const count = messages.length;
      const response = await post(base, payload, headers);
      assert.equal(response.status, 401);
      assert.equal(messages.length, count);
      const body = await response.text();
      assert.equal(body.includes(env.NOTIFICATION_SERVICE_TOKEN), false);
    });
  }
});

test('P0-02: authorized malicious payloads are rejected before Nodemailer, directly and through Gateway', async t => {
  const canary = path.join(fixtureDir, 'canary.txt');
  fs.writeFileSync(canary, 'SYNTHETIC_FILE_CANARY');
  const invalid = [
    ['local path', { ...payload, text: { path: canary } }],
    ['remote path', { ...payload, text: { path: 'http://127.0.0.1:1/canary' } }],
    ['array text', { ...payload, text: ['content'] }],
    ['null text', { ...payload, text: null }],
    ['missing text', { to: payload.to, subject: payload.subject }],
    ['subject object', { ...payload, subject: { path: canary } }],
    ['recipient object', { ...payload, to: { address: payload.to } }],
    ['invalid recipient', { ...payload, to: 'invalid' }],
    ['header injection', { ...payload, subject: 'Subject\r\nBcc: attacker@example.invalid' }],
    ['unknown attachment', { ...payload, attachments: [{ path: canary }] }],
    ['raw message', { ...payload, raw: { path: canary } }],
    ['disable override', { ...payload, disableFileAccess: false }],
    ['long subject', { ...payload, subject: 's'.repeat(201) }],
    ['long text', { ...payload, text: 't'.repeat(10001) }],
    ['too many recipients', { ...payload, to: Array(11).fill(payload.to).join(',') }],
    ['empty body', {}],
    ['array body', []],
  ];
  for (const [name, base] of [['direct', notificationUrl], ['gateway', gatewayUrl]]) {
    for (const [type, body] of invalid) await t.test(`${name}: ${type} -> 400`, async () => {
      const count = messages.length;
      const response = await post(base, body);
      assert.equal(response.status, 400);
      assert.equal(messages.length, count);
    });
  }
});

test('P0-02: malformed JSON and oversized request have controlled HTTP errors', async () => {
  for (const base of [notificationUrl, gatewayUrl]) {
    const malformed = await fetch(`${base}/notify`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.match(malformed.headers.get('content-type'), /application\/json/);
    const oversized = await post(base, { ...payload, text: 't'.repeat(40000) });
    assert.equal(oversized.status, 413);
  }
});

test('P0-02: actual Nodemailer refuses file and URL access even if validation is bypassed', async () => {
  let productionTransport;
  const started = startNotifications({ env, logger: quiet, createTransport(options) {
    productionTransport = nodemailer.createTransport({ ...options, service: undefined, auth: undefined,
      streamTransport: true, buffer: true });
    transports.push(productionTransport);
    return productionTransport;
  } });
  servers.push(started.server);
  await once(started.server, 'listening');
  for (const file of [path.join(fixtureDir, 'canary.txt'), 'http://127.0.0.1:1/canary']) {
    await assert.rejects(productionTransport.sendMail({ from: env.EMAIL_USER, to: payload.to,
      subject: payload.subject, text: { path: file } }), /access rejected/i);
  }
});

test('P1-03: authorized notifications work directly, through Gateway and through the real backend client', async () => {
  const count = messages.length;
  assert.equal((await post(notificationUrl, payload)).status, 200);
  assert.equal((await post(gatewayUrl, { ...payload, to: 'one@example.invalid, two@example.invalid' })).status, 200);
  const response = await sendNotification(payload, { env: { ...env, NOTIFICATION_GATEWAY_URL: gatewayUrl } });
  assert.equal(response.status, 200);
  assert.equal(messages.length, count + 3);
  const last = messages.at(-1);
  assert.equal(last.options.text, payload.text);
  assert.equal(last.options.subject, payload.subject);
  assert.equal(last.options.to, payload.to);
  assert.equal(last.options.disableFileAccess, true);
  assert.equal(last.options.disableUrlAccess, true);
  assert.match(last.mime, /Commande factice/);
});

test('P1-03: Gateway does not bypass a different service credential', async () => {
  const gatewayToken = randomBytes(32).toString('base64url');
  const mismatched = await listen(createGatewayApp({ env: {
    ...env, NOTIFICATION_SERVICE_TOKEN: gatewayToken, NOTIFI_SERVICE_URL: notificationUrl,
  } }));
  const count = messages.length;
  // Valid at the Gateway, invalid at the downstream service: both checks matter.
  assert.equal((await post(mismatched, payload, { Authorization: `Bearer ${gatewayToken}` })).status, 401);
  assert.equal(messages.length, count);
});

test('Gateway: unavailable notifications return a generic 502 without credential disclosure', async () => {
  const url = await listen(createGatewayApp({ env: { ...env, NOTIFI_SERVICE_URL: 'http://127.0.0.1:1' } }));
  const response = await post(url, payload);
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.equal(body.includes(env.NOTIFICATION_SERVICE_TOKEN), false);
  assert.equal(body.includes('ECONNREFUSED'), false);
});

test('P1-03: backend refuses missing configuration without making an HTTP call', async () => {
  let called = false;
  await assert.rejects(sendNotification(payload, { env: {}, httpClient: { post() { called = true; } } }));
  assert.equal(called, false);
});

test('P1-03: backend client bounds time and refuses redirects that could leak its credential', async () => {
  const express = gatewayRequire('express');
  const trap = express(); let hits = 0;
  trap.post('/notify', (req, res) => { hits++; res.sendStatus(200); });
  const trapUrl = await listen(trap);
  const redirect = express();
  redirect.post('/notify', (req, res) => res.redirect(307, `${trapUrl}/notify`));
  const redirectUrl = await listen(redirect);
  await assert.rejects(sendNotification(payload, { env: { ...env, NOTIFICATION_GATEWAY_URL: redirectUrl } }));
  assert.equal(hits, 0);
  let options;
  await sendNotification(payload, { env, httpClient: { async post(url, body, config) { options = config; return {}; } } });
  assert.equal(options.timeout, 10000);
  assert.equal(options.maxRedirects, 0);
});

test('P1-03: rate limiter rejects excess authorized sends and reopens after its window', async () => {
  let time = 0;
  const url = await listen(createNotificationApp({ env, transporter: memoryTransport(), logger: quiet,
    now: () => time, rateLimit: { max: 2, windowMs: 60000 } }));
  assert.equal((await post(url, payload, {})).status, 401);
  assert.equal((await post(url, payload)).status, 200);
  assert.equal((await post(url, payload)).status, 200);
  const count = messages.length;
  const limited = await post(url, payload);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal(messages.length, count);
  time = 60000;
  assert.equal((await post(url, payload)).status, 200);
});

test('Notifications: SMTP failure is controlled without leaking secret/body/error details', async () => {
  const logs = [];
  const marker = 'SYNTHETIC_SENSITIVE_ERROR';
  const url = await listen(createNotificationApp({ env,
    transporter: { async sendMail() { throw Object.assign(new Error(marker), { code: marker, response: env.EMAIL_APPLICATION_PASSWORD }); } },
    logger: { error: (...args) => logs.push(args) } }));
  const response = await post(url, payload);
  assert.equal(response.status, 500);
  const body = await response.text();
  for (const sensitive of [marker, env.EMAIL_APPLICATION_PASSWORD, env.NOTIFICATION_SERVICE_TOKEN, payload.to, payload.text]) {
    assert.equal((body + JSON.stringify(logs)).includes(sensitive), false);
  }
});

test('Gateway: stock proxy contract is preserved', async () => {
  const body = { productId: 'synthetic', quantity: 1 };
  const response = await fetch(`${gatewayUrl}/update-stock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: body });
});

test('Backend regression with isolated MongoDB: registration, JWT, products, admin protection, order -> Gateway -> memory email', async () => {
  const mongoose = backendRequire('mongoose');
  const database = `e27_notifications_test_${randomBytes(8).toString('hex')}`;
  assert.match(database, /^e27_notifications_test_[0-9a-f]{16}$/);
  // Explicit URI and generated database; never read MONGO_URI from a .env.
  const uri = `mongodb://127.0.0.1:27017/${database}`;
  process.env.JWT_SECRET = randomBytes(32).toString('base64url');
  process.env.NOTIFICATION_SERVICE_TOKEN = env.NOTIFICATION_SERVICE_TOKEN;
  process.env.NOTIFICATION_GATEWAY_URL = gatewayUrl;
  process.env.DEBUG = '';
  const oldLog = console.log, oldError = console.error;
  console.log = () => {}; console.error = () => {};
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    assert.equal(mongoose.connection.name, database);
    const { createBackendApp } = require('../backend/app');
    const User = require('../backend/models/User');
    const Product = require('../backend/models/Product');
    const Order = require('../backend/models/Order');
    const url = await listen(createBackendApp());
    const api = (route, body, token) => fetch(`${url}/api/${route}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    });
    const user = { username: 'notification_test_user', email: 'customer@example.invalid', password: 'Synthetic-password-2026' };
    assert.equal((await api('auth/register', user)).status, 201);
    assert.equal(await User.countDocuments(), 1);
    assert.ok((await api('auth/register', {})).status >= 400);
    assert.equal(await User.countDocuments(), 1);
    const login = await api('auth/login', { username: user.username, password: user.password });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.equal(backendRequire('jsonwebtoken').verify(token, process.env.JWT_SECRET).role, 'user');
    assert.equal((await api('orders')).status, 401);
    assert.equal((await api('orders', undefined, token)).status, 403);
    const product = await Product.create({ name: 'Produit test', description: 'Fictif', price: 20, stock: 3 });
    const products = await api('products');
    assert.equal(products.status, 200);
    assert.equal((await products.json()).length, 1);
    const before = messages.length;
    const orderResponse = await api('orders', {
      items: [{ productId: product._id.toString(), quantity: 2, price: 20 }],
      shippingAddress: { street: 'Test', city: 'Test', postalCode: '00000', country: 'Test' },
      paymentMethod: 'Carte bancaire', shippingMethod: 'colissimo',
    }, token);
    assert.equal(orderResponse.status, 201);
    const { order } = await orderResponse.json();
    assert.equal(order.total, 40);
    assert.equal(await Order.countDocuments(), 1);
    assert.equal(messages.length, before + 1);
    assert.match(messages.at(-1).options.text, new RegExp(product._id.toString()));
    // Known P1-02 is observed, not claimed fixed in this notifications stage.
    assert.equal((await Product.findById(product._id)).stock, 3);
    const admin = await User.create({ username: 'notification_test_admin', email: 'admin@example.invalid', password: user.password, role: 'admin' });
    const adminLogin = await api('auth/login', { username: admin.username, password: user.password });
    const adminToken = (await adminLogin.json()).token;
    assert.equal((await api('orders', undefined, adminToken)).status, 200);
  } finally {
    try {
      // Drop only this generated, test-prefixed database through its own connection.
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === database && /^e27_notifications_test_[0-9a-f]{16}$/.test(database)) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
      console.log = oldLog; console.error = oldError;
    }
  }
});

test.todo('P1-01 later stage: reject client-controlled order prices using isolated database');
test.todo('P1-02 later stage: atomic stock decrement, concurrency and compensation using isolated database');
test.todo('P1-06/P1-07 later stage: reject NoSQL operators and invalid registration formats');
