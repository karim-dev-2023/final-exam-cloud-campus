const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes, randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const backendRequire = createRequire(path.resolve(__dirname, '../backend/package.json'));
const mailRequire = createRequire(path.resolve(__dirname, '../microservices/notifications/package.json'));
const mongoose = backendRequire('mongoose');
const User = require('../backend/models/User');
const Product = require('../backend/models/Product');
const Order = require('../backend/models/Order');
const Attempt = require('../backend/models/CheckoutAttempt');
const checkout = require('../backend/services/checkoutService');
const { createBackendApp } = require('../backend/app');
const { createStockApp } = require('../microservices/stock-management/app');
const { createNotificationApp } = require('../microservices/notifications/app');
const { createGatewayApp } = require('../gateway/app');
const password = 'Synthetic-password-2026';
const database = `e27_final_test_${randomBytes(8).toString('hex')}`;
const servers = [];
const mails = [];
let base, stockUrl, gatewayUrl, token, user, transport;
const oldLog = console.log, oldError = console.error;

async function listen(app) {
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`;
}
async function api(route, body, auth = token, method = body === undefined ? 'GET' : 'POST', key) {
  return fetch(`${base}/api/${route}`, { method, headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
}
const orderBody = (items, other = {}) => ({ items, shippingAddress: { street: 'Test', city: 'Test', postalCode: '00000', country: 'Test' },
  paymentMethod: 'Carte bancaire', shippingMethod: 'colissimo', ...other });
async function product(price = 20, stock = 5) { return Product.create({ name: 'Fictif', description: 'Produit de test', price, stock }); }
async function attemptFor(p, quantity = 1, duration = 30000) {
  return Attempt.create({ state: 'reserving', reserveUntil: new Date(Date.now() + duration), fingerprint: 'synthetic',
    order: { ...orderBody([{ productId: p._id, quantity, price: p.price }]), userId: user._id, total: p.price * quantity } });
}
async function stockOf(p) { return (await Product.findById(p._id)).stock; }

before(async () => {
  console.log = () => {}; console.error = () => {};
  process.env.JWT_SECRET = randomBytes(32).toString('base64url');
  process.env.NOTIFICATION_SERVICE_TOKEN = randomBytes(32).toString('base64url');
  process.env.DEBUG = '';
  assert.match(database, /^e27_final_test_[0-9a-f]{16}$/);
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000 });
  assert.equal(mongoose.connection.name, database);
  await Promise.all([User.init(), Product.init(), Order.init(), Attempt.init()]);
  transport = mailRequire('nodemailer').createTransport({ streamTransport: true, buffer: true, disableFileAccess: true, disableUrlAccess: true });
  const notificationUrl = await listen(createNotificationApp({ env: { ...process.env, EMAIL_USER: 'sender@example.invalid' },
    rateLimit: { max: 500, windowMs: 60000 }, logger: { error() {} },
    transporter: { async sendMail(options) { const mime = await transport.sendMail(options); mails.push(mime.message.toString()); return mime; } } }));
  stockUrl = await listen(createStockApp());
  process.env.STOCK_SERVICE_URL = stockUrl;
  gatewayUrl = await listen(createGatewayApp({ env: { ...process.env, NOTIFI_SERVICE_URL: notificationUrl }, stockProxy: require('../gateway/routes/stock') }));
  process.env.NOTIFICATION_GATEWAY_URL = gatewayUrl;
  base = await listen(createBackendApp({authLimit:{max:1000}}));
});
beforeEach(async () => {
  assert.equal(mongoose.connection.name, database);
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({}), Attempt.deleteMany({})]);
  mails.length = 0;
  user = await User.create({ username: 'checkout_user', email: 'checkout@example.invalid', password });
  const login = await api('auth/login', { username: user.username, password }, null);
  assert.equal(login.status, 200); token = (await login.json()).token;
});
after(async () => {
  try {
    for (const server of servers.reverse()) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (transport) transport.close();
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database && /^e27_final_test_[0-9a-f]{16}$/.test(database)) await mongoose.connection.dropDatabase();
  } finally { await mongoose.disconnect(); console.log = oldLog; console.error = oldError; }
});

test('P1-01: forged negative prices and totals are replaced by catalogue prices', async () => {
  const p = await product(19.99, 10);
  const response = await api('orders', orderBody([{ productId: String(p._id), quantity: 3, price: -999 }], { total: -1 }));
  assert.equal(response.status, 201);
  const result = (await response.json()).order;
  assert.equal(result.items[0].price, 19.99); assert.equal(result.total, 59.97);
  const saved = await Order.findById(result._id);
  assert.equal(saved.total, 59.97); assert.equal(await stockOf(p), 7); assert.equal(mails.length, 1);
});
test('P1-01: omitted prices, duplicate lines and cents are calculated on the server', async () => {
  const a = await product(0.1), b = await product(0.2);
  const response = await api('orders', orderBody([
    { productId: String(a._id), quantity: 1 }, { productId: String(a._id), quantity: 2, price: { $ne: null } },
    { productId: String(b._id), quantity: 1, price: 0 },
  ]));
  assert.equal(response.status, 201);
  const order = (await response.json()).order;
  assert.equal(order.total, 0.5); assert.equal(order.items.length, 2);
  assert.equal(await stockOf(a), 2); assert.equal(await stockOf(b), 4);
});
test('P1-01: nonexistent products fail without any order or inventory mutation', async () => {
  const p = await product();
  const response = await api('orders', orderBody([{ productId: String(new mongoose.Types.ObjectId()), quantity: 1, price: 1 }]));
  assert.equal(response.status, 404); assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Attempt.countDocuments(), 0); assert.equal(await stockOf(p), 5);
});
test('P1-01: catalogue price change during reservation aborts and refunds earlier items', async () => {
  const a = await product(10, 3), b = await product(20, 3);
  const original = Product.findOneAndUpdate; let changed = false;
  Product.findOneAndUpdate = async function (filter, ...args) {
    if (String(filter._id) === String(b._id) && !changed) {
      changed = true; await Product.updateOne({ _id: b._id }, { $set: { price: 30 } });
    }
    return original.call(this, filter, ...args);
  };
  let response;
  try { response = await api('orders', orderBody([{ productId: String(a._id), quantity: 1 }, { productId: String(b._id), quantity: 1 }])); }
  finally { Product.findOneAndUpdate = original; }
  assert.equal(response.status, 409); assert.equal(await Order.countDocuments(), 0);
  assert.equal(await stockOf(a), 3); assert.equal(await stockOf(b), 3);
});

test('P1-02: invalid quantities are rejected before reservations', async () => {
  const p = await product();
  for (const quantity of [0, -1, 1.5, '2', null, {}, 10001]) {
    const response = await api('orders', orderBody([{ productId: String(p._id), quantity }]));
    assert.equal(response.status, 400);
  }
  assert.equal(await Order.countDocuments(), 0); assert.equal(await Attempt.countDocuments(), 0); assert.equal(await stockOf(p), 5);
});
test('P1-02: ten concurrent purchases of the last unit produce exactly one order', async () => {
  const p = await product(20, 1);
  const responses = await Promise.all(Array.from({ length: 10 }, () => api('orders', orderBody([{ productId: String(p._id), quantity: 1 }]), token, 'POST', randomUUID())));
  assert.equal(responses.filter(r => r.status === 201).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 9);
  assert.equal(await Order.countDocuments(), 1); assert.equal(await stockOf(p), 0); assert.equal(mails.length, 1);
});
test('P1-02: unavailable second item compensates the first reservation exactly once', async () => {
  const a = await product(10, 3), b = await product(20, 0);
  const response = await api('orders', orderBody([{ productId: String(a._id), quantity: 2 }, { productId: String(b._id), quantity: 1 }]));
  assert.equal(response.status, 409); assert.equal(await Order.countDocuments(), 0);
  assert.equal(await stockOf(a), 3); assert.equal(await stockOf(b), 0);
  const attempt = await Attempt.findOne(); assert.equal(attempt.state, 'failed');
  await Promise.all(Array.from({ length: 5 }, () => checkout.recoverCheckout(attempt._id)));
  assert.equal(await stockOf(a), 3); assert.equal(mails.length, 0);
});
test('P1-02: database error during reservation compensates earlier writes', async () => {
  const a = await product(10, 3), b = await product(20, 3);
  const original = Product.findOneAndUpdate;
  Product.findOneAndUpdate = function (filter, ...args) {
    if (String(filter._id) === String(b._id)) throw new Error('Synthetic reservation outage');
    return original.call(this, filter, ...args);
  };
  let response;
  try { response = await api('orders', orderBody([{ productId: String(a._id), quantity: 2 }, { productId: String(b._id), quantity: 1 }])); }
  finally { Product.findOneAndUpdate = original; }
  assert.equal(response.status, 503); assert.equal(await stockOf(a), 3); assert.equal(await stockOf(b), 3); assert.equal(await Order.countDocuments(), 0);
  assert.equal((await Attempt.findOne()).state, 'failed');
});
test('P1-02: failed compensation is durable and concurrent recovery never refunds twice', async () => {
  const a = await product(10, 3), b = await product(20, 0);
  const original = Product.updateOne;
  Product.updateOne = function (filter, update, ...args) {
    if (update.$inc?.stock > 0) throw new Error('Synthetic refund outage');
    return original.call(this, filter, update, ...args);
  };
  let response;
  try { response = await api('orders', orderBody([{ productId: String(a._id), quantity: 2 }, { productId: String(b._id), quantity: 1 }])); }
  finally { Product.updateOne = original; }
  assert.equal(response.status, 503); assert.equal(await stockOf(a), 1); assert.equal(await Order.countDocuments(), 0);
  const attempt = await Attempt.findOne(); assert.equal(attempt.state, 'compensating');
  await Promise.all(Array.from({ length: 5 }, () => checkout.recoverCheckouts()));
  assert.equal(await stockOf(a), 3); assert.equal((await Attempt.findById(attempt._id)).state, 'failed');
});
test('P1-02: committed checkout survives order-write outage and is materialized once', async () => {
  const p = await product(20, 3), key = randomUUID();
  const body = orderBody([{ productId: String(p._id), quantity: 2 }]);
  const original = Order.collection.updateOne;
  Order.collection.updateOne = async () => { throw new Error('Synthetic order-write outage'); };
  let response;
  try { response = await api('orders', body, token, 'POST', key); }
  finally { Order.collection.updateOne = original; }
  assert.equal(response.status, 503); assert.equal(await Order.countDocuments(), 0); assert.equal(await stockOf(p), 1);
  const attempt = await Attempt.findOne(); assert.equal(attempt.state, 'committed');
  await Promise.all(Array.from({ length: 5 }, () => checkout.recoverCheckouts()));
  assert.equal(await Order.countDocuments(), 1); assert.equal(await stockOf(p), 1);
  assert.equal((await Attempt.findById(attempt._id)).state, 'completed');
  const replay = await api('orders', body, token, 'POST', key);
  assert.equal(replay.status, 200); assert.equal((await replay.json()).order._id, String(attempt._id));
  assert.equal(await Order.countDocuments(), 1); assert.equal(await stockOf(p), 1);
});
test('P1-02: ambiguous commit acknowledgement does not refund a committed purchase', async () => {
  const p = await product(20, 3);
  const original = Attempt.findOneAndUpdate; let lost = false;
  Attempt.findOneAndUpdate = async function (filter, update, ...args) {
    const result = await original.call(this, filter, update, ...args);
    if (update.$set?.state === 'committed' && !lost) { lost = true; throw new Error('Synthetic lost acknowledgement'); }
    return result;
  };
  let response;
  try { response = await api('orders', orderBody([{ productId: String(p._id), quantity: 2 }])); }
  finally { Attempt.findOneAndUpdate = original; }
  assert.equal(response.status, 201); assert.equal(await stockOf(p), 1); assert.equal(await Order.countDocuments(), 1);
});
test('P1-02: expired abandoned reservation is recovered and fencing markers are cleaned', async () => {
  const p = await product(20, 3), attempt = await attemptFor(p, 2, 150);
  await checkout.reserveCheckoutItem(String(attempt._id), String(p._id), 2);
  assert.equal(await stockOf(p), 1);
  await delay(200);
  await checkout.recoverCheckouts(); await checkout.recoverCheckouts();
  assert.equal(await stockOf(p), 3); assert.equal(await Order.countDocuments(), 0);
  assert.equal((await Attempt.findById(attempt._id)).state, 'failed');
  assert.equal((await Product.findById(p._id).select('+reservations')).reservations.length, 0);
});
test('P1-02: compensation fences a late reservation even for an initially unreserved item', async () => {
  const p = await product(), attempt = await attemptFor(p, 2);
  await Attempt.updateOne({ _id: attempt._id }, { $set: { state: 'compensating' } });
  await checkout.recoverCheckout(attempt._id);
  // Simulate the stale atomic write of an already-started caller.
  const late = await Product.findOneAndUpdate({ _id: p._id, stock: { $gte: 2 }, 'reservations.checkoutId': { $ne: attempt._id },
    $expr: { $lt: ['$$NOW', attempt.reserveUntil] } }, { $inc: { stock: -2 }, $push: { reservations: { checkoutId: attempt._id, quantity: 2, state: 'held' } } });
  assert.equal(late, null); assert.equal(await stockOf(p), 5);
});
test('P1-02: concurrent retries with one idempotency key cannot duplicate inventory or order', async () => {
  const p = await product(20, 5), key = randomUUID(), body = orderBody([{ productId: String(p._id), quantity: 2 }]);
  const results = await Promise.all(Array.from({ length: 5 }, () => api('orders', body, token, 'POST', key)));
  assert.ok(results.every(r => [200, 201, 409].includes(r.status)));
  assert.equal(await Order.countDocuments(), 1); assert.equal(await stockOf(p), 3);
  const replay = await api('orders', body, token, 'POST', key); assert.equal(replay.status, 200);
  assert.equal(await Attempt.countDocuments(), 1); assert.equal(mails.length, 1);
  const different = await api('orders', orderBody([{ productId: String(p._id), quantity: 1 }]), token, 'POST', key);
  assert.equal(different.status, 409); assert.equal(await stockOf(p), 3);
});
test('P1-02: stock microservice authenticates, validates and reserves real inventory idempotently', async () => {
  const p = await product(), attempt = await attemptFor(p, 2);
  const send = (body, authenticated = true, url = stockUrl) => fetch(`${url}/update-stock`, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(authenticated ? { Authorization: `Bearer ${process.env.NOTIFICATION_SERVICE_TOKEN}` } : {}) }, body: JSON.stringify(body) });
  const body = { checkoutId: String(attempt._id), productId: String(p._id), quantity: 2 };
  assert.equal((await send(body, false)).status, 401);
  assert.equal((await send({ ...body, quantity: -1 })).status, 400);
  assert.equal((await send({ ...body, checkoutId: String(new mongoose.Types.ObjectId()) })).status, 409);
  assert.equal((await send(body)).status, 200); assert.equal((await send(body)).status, 200);
  assert.equal((await send(body, false, gatewayUrl)).status, 401);
  assert.equal((await send(body, true, gatewayUrl)).status, 200);
  assert.equal(await stockOf(p), 3);
  await Attempt.updateOne({ _id: attempt._id }, { $set: { state: 'compensating' } });
  await checkout.recoverCheckout(attempt._id); assert.equal(await stockOf(p), 5);
});
test('P1-02: startup recovery automatically materializes a committed journal without double decrement', async () => {
  const p = await product(20, 3), attempt = await attemptFor(p, 2);
  await checkout.reserveCheckoutItem(String(attempt._id), String(p._id), 2);
  await Attempt.updateOne({ _id: attempt._id }, { $set: { state: 'committed' } });
  const stop = checkout.startCheckoutRecovery({ error() {} }, 20);
  try {
    for (let i = 0; i < 100 && !(await Order.exists({ _id: attempt._id })); i++) await delay(20);
    assert.equal(await Order.countDocuments(), 1); assert.equal(await stockOf(p), 1);
  } finally { await stop(); }
  const products = await api('products');
  assert.equal((await products.json())[0].reservations, undefined);
});
test('P1-02: admin stock validation preserves zero and rejects fractional inventory', async () => {
  const p = await product();
  const admin = await User.create({ username: 'admin_test', email: 'admin@example.invalid', password, role: 'admin' });
  const login = await api('auth/login', { username: admin.username, password }, null), adminToken = (await login.json()).token;
  assert.equal((await api(`products/${p._id}/stock`, { stock: 1.5 }, adminToken, 'PUT')).status, 400);
  assert.equal((await api(`products/${p._id}/stock`, { stock: '0' }, adminToken, 'PUT')).status, 200);
  assert.equal(await stockOf(p), 0);
  assert.equal((await api(`products/${p._id}/stock`, { stock: 3 }, token, 'PUT')).status, 403);
});

test('P1-06: NoSQL objects in login fields are rejected before any model query', async () => {
  const original = User.findOne; let reads = 0;
  User.findOne = function (...args) { reads++; return original.apply(this, args); };
  try {
    for (const username of [{ $ne: null }, { $regex: '.*' }, ['checkout_user'], null]) {
      assert.equal((await api('auth/login', { username, password }, null)).status, 400);
    }
    assert.equal((await api('auth/login', { username: user.username, password: { $ne: null } }, null)).status, 400);
    assert.equal(reads, 0);
  } finally { User.findOne = original; }
});
test('P1-06: NoSQL objects in registration fields are rejected without reads or writes', async () => {
  const original = User.findOne; let reads = 0;
  User.findOne = function (...args) { reads++; return original.apply(this, args); };
  try {
    for (const field of ['username', 'email', 'password']) {
      assert.equal((await api('auth/register', { username: 'new_user', email: 'new@example.invalid', password, [field]: { $ne: null } }, null)).status, 400);
    }
    assert.equal(reads, 0); assert.equal(await User.countDocuments(), 1);
  } finally { User.findOne = original; }
});
test('P1-06: valid legacy credentials and literal operator-like strings remain safe', async () => {
  assert.equal((await api('auth/login', { username: user.username, password }, null)).status, 200);
  assert.equal((await api('auth/login', { username: '{"$ne":null}', password }, null)).status, 401);
  assert.equal((await api('orders', undefined, null)).status, 401);
  assert.equal((await api('orders')).status, 403);
  const legacyHash = await backendRequire('bcryptjs').hash('legacy-weak', 10);
  await User.collection.insertOne({ username: 'a', email: 'legacy@example.invalid', password: legacyHash, role: 'user' });
  assert.equal((await api('auth/login', { username: 'a', password: 'legacy-weak' }, null)).status, 200);
  assert.equal((await User.findOne({ username: 'a' })).password, legacyHash);
});

test('P1-07: invalid email formats never create a user', async () => {
  for (const email of ['invalid', 'a@', '@example.fr', 'a b@example.fr', 'a@example..fr', '.a@example.fr', 'a..b@example.fr', 'a@-bad.fr', 'a@example.fr\r\nBcc:x@y.fr']) {
    assert.equal((await api('auth/register', { username: 'valid_name', email, password }, null)).status, 400);
  }
  assert.equal(await User.countDocuments(), 1);
});
test('P1-07: empty and whitespace-only usernames and weak passwords are rejected', async () => {
  for (const username of ['', '   ', 'ab', 'x'.repeat(51), 'name\nvalue']) {
    assert.equal((await api('auth/register', { username, email: 'valid@example.fr', password }, null)).status, 400);
  }
  for (const weak of ['', 'short', 'abcdefghijkl', 'ABCDEFGHIJKL', '123456789012', 'abcdefghijk1', 'Abcdefghij1', 'Aa1' + 'x'.repeat(70), 'Aa1' + 'é'.repeat(36)]) {
    assert.equal((await api('auth/register', { username: 'valid_name', email: 'valid@example.fr', password: weak }, null)).status, 400);
  }
  assert.equal(await User.countDocuments(), 1);
});
test('P1-07: valid normalized registration, bcrypt and JWT work without accepting admin role', async () => {
  const response = await api('auth/register', { username: '  new_user  ', email: '  New+tag@Example.FR  ', password, role: 'admin' }, null);
  assert.equal(response.status, 201);
  const saved = await User.findOne({ username: 'new_user' });
  assert.equal(saved.email, 'new+tag@example.fr'); assert.equal(saved.role, 'user'); assert.notEqual(saved.password, password);
  assert.equal(await backendRequire('bcryptjs').compare(password, saved.password), true);
  const login = await api('auth/login', { username: 'new_user', password }, null); assert.equal(login.status, 200);
  const jwt = backendRequire('jsonwebtoken').verify((await login.json()).token, process.env.JWT_SECRET);
  assert.equal(jwt.role, 'user'); assert.equal(jwt.exp - jwt.iat, 3600);
});
test('P1-07: duplicate and concurrent registrations return 409 instead of server errors', async () => {
  const body = { username: 'duplicate_user', email: 'duplicate@example.fr', password };
  const results = await Promise.all(Array.from({ length: 4 }, () => api('auth/register', body, null)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 3);
  assert.equal(await User.countDocuments({ username: body.username }), 1);
});
test('P1-07: schema validation independently rejects malformed new users', async () => {
  await assert.rejects(new User({ username: '   ', email: 'invalid', password: 'x' }).validate(), { name: 'ValidationError' });
  assert.equal(await User.countDocuments(), 1);
});
