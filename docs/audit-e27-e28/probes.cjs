// Audit only: no application edits, real database access or outgoing mail.
// Run from the workspace root: node docs/audit-e27-e28/probes.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '../../exam1');
const backendRequire = createRequire(path.join(root, 'backend/package.json'));
const Order = backendRequire('./models/Order');
const Product = backendRequire('./models/Product');
const User = backendRequire('./models/User');
const results = [];
const quiet = { log() {}, error() {}, warn() {} };
function load(file, mocks = {}, env = {}) {
  const filename = path.join(root, file);
  const req = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports,
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : req(id),
    process: { env }, console: quiet, Date,
  }, { filename });
  return module.exports;
}
function response() {
  return { code: 200, ended: false, status(c) { this.code = c; return this; },
    json(body) { this.body = body; this.ended = true; return this; },
    send(body) { this.body = body; this.ended = true; return this; },
    sendStatus(c) { this.code = c; this.ended = true; return this; } };
}
async function check(id, fn) {
  try { results.push({ id, outcome: 'observed', detail: await fn() }); }
  catch (e) { results.push({ id, outcome: 'probe failed', detail: e.name }); }
}
const id = '000000000000000000000001';
const baseOrder = { userId: id, items: [{ productId: id, quantity: 1, price: 10 }],
  shippingAddress: { street: 'Test', city: 'Test', postalCode: '00000', country: 'Test' },
  paymentMethod: 'Carte bancaire', shippingMethod: 'colissimo', total: 10 };
const controllerMocks = { dotenv: { config() {} }, debug: () => () => {} };
async function main() {
  await check('ORDER_CLIENT_PRICE_AND_STOCK', async () => {
    let saved, calls = [];
    class FakeOrder { constructor(data) { Object.assign(this, data); }
      async save() { const real = new Order(this); await real.validate(); saved = real.toObject(); return saved; } }
    const c = load('backend/controllers/orderController.js', {
      ...controllerMocks, '../models/Order': FakeOrder,
      axios: { async post(url) { calls.push(url); return {}; } },
    });
    const r = response();
    await c.createOrder({ user: { userId: id }, body: { ...baseOrder, items: [{ productId: id, quantity: 999999, price: -1 }] } }, r);
    assert.equal(r.code, 201); assert.equal(saved.total, -999999);
    assert.equal(calls.filter(x => x.includes('stock')).length, 0);
    return { status: r.code, acceptedPrice: -1, acceptedQuantity: 999999, total: saved.total, stockCalls: 0, catalogueLookups: 0, persistence: 'mock only' };
  });
  await check('ORDER_INVALID_INPUT_HTTP', async () => {
    class FakeOrder { constructor(data) { Object.assign(this, data); } async save() { await new Order(this).validate(); } }
    const c = load('backend/controllers/orderController.js', { ...controllerMocks, '../models/Order': FakeOrder, axios: {} });
    const r = response(); await c.createOrder({ user: { userId: id }, body: { ...baseOrder, items: [{ productId: 'invalid', quantity: 0, price: 10 }] } }, r);
    assert.equal(r.code, 500); return { status: r.code, expected: 400 };
  });
  await check('ORDER_FRACTIONAL_QUANTITY', () => {
    const e = new Order({ ...baseOrder, items: [{ productId: id, quantity: 1.5, price: 10 }] }).validateSync();
    assert.equal(e, undefined); return 'Model accepts quantity 1.5';
  });
  await check('ORDER_DELETE_AND_VALIDATE', async () => {
    let writes = 0;
    const c = load('backend/controllers/orderController.js', { ...controllerMocks, '../models/Order': { findByIdAndUpdate() { writes++; } }, axios: {} });
    const a = response(); await c.deleteOrder({ params: { id }, body: {} }, a);
    const b = response(); await c.validateOrder({ params: { id }, body: {} }, b);
    assert.equal(a.ended, false); assert.equal(b.code, 200); assert.equal(writes, 0);
    return { deleteResponded: a.ended, validateStatus: b.code, validateUsesUndefinedId: b.body.message.includes('undefined'), databaseWrites: writes };
  });
  await check('ORDER_STATUS_WITHOUT_VALIDATORS', async () => {
    let options;
    const c = load('backend/controllers/orderController.js', { ...controllerMocks, '../models/Order': {
      async findByIdAndUpdate(orderId, update, opts) { options = opts; return { _id: orderId, ...update }; }
    }, axios: {} });
    const r = response(); await c.updateOrderStatus({ params: { orderId: id }, body: { status: 'arbitrary-status' } }, r);
    assert.equal(r.code, 200); assert.equal(options.runValidators, undefined);
    return { status: r.code, acceptedStatus: r.body.order.status, runValidators: false, persistence: 'mock only' };
  });
  await check('AUTH_NOSQL_FILTER', async () => {
    let filter;
    const c = load('backend/controllers/authController.js', { ...controllerMocks,
      '../models/User': { async findOne(f) { filter = f; return null; } },
    });
    const r = response(); await c.login({ body: { username: { $ne: null }, password: 'synthetic' } }, r);
    assert.deepEqual(JSON.parse(JSON.stringify(filter)), { username: { $ne: null } });
    return { operatorReachedModel: true, status: r.code, authenticationBypassProven: false };
  });
  await check('LOGIN_VALID_AND_INVALID_PASSWORD', async () => {
    const bcrypt = backendRequire('bcryptjs'); const jwt = backendRequire('jsonwebtoken');
    const secret = 'audit-only-synthetic-key';
    const password = await bcrypt.hash('synthetic-audit-password', 10);
    const c = load('backend/controllers/authController.js', { ...controllerMocks,
      '../models/User': { async findOne() { return { _id: id, username: 'audit', password, role: 'user' }; } },
    }, { JWT_SECRET: secret });
    const a = response(); await c.login({ body: { username: 'audit', password: 'synthetic-audit-password' } }, a);
    const payload = jwt.verify(a.body.token, secret);
    const b = response(); await c.login({ body: { username: 'audit', password: 'wrong-synthetic' } }, b);
    const missing = response(); await c.login({ body: { username: 'audit' } }, missing);
    assert.equal(a.code, 200); assert.equal(payload.role, 'user'); assert.equal(payload.exp - payload.iat, 3600);
    assert.equal(b.code, 400); assert.equal(missing.code, 500);
    return { correctPassword: 200, wrongPassword: 400, missingPassword: 500, tokenLifetimeSeconds: 3600, databaseAccess: false };
  });
  await check('REGISTER_WEAK_FIELDS', () => {
    assert.equal(new User({ username: '   ', email: 'invalid-email', password: 'x' }).validateSync(), undefined);
    return 'Model accepts whitespace username, invalid email and one-character password';
  });
  await check('REGISTER_EMPTY_AND_DUPLICATE_HTTP', async () => {
    class FakeUser { constructor(data) { Object.assign(this, data); } static async findOne() { return null; }
      async save() { await new User(this).validate(); } }
    const c = load('backend/controllers/authController.js', { ...controllerMocks, '../models/User': FakeUser });
    const a = response(); await c.register({ body: {} }, a); assert.equal(a.code, 500);
    FakeUser.prototype.save = async () => { const e = new Error('synthetic duplicate'); e.code = 11000; throw e; };
    const b = response(); await c.register({ body: { username: 'duplicate', email: 'test@example.invalid', password: 'synthetic' } }, b);
    assert.equal(b.code, 500); return { emptyBody: a.code, duplicateUsername: b.code, persistence: 'mock only' };
  });
  await check('STOCK_FRACTION_AND_TYPE_HTTP', async () => {
    let value;
    const c = load('backend/controllers/productController.js', { '../models/Product': {
      async findById() { return { set stock(x) { value = x; }, async save() { await new Product({ name: 'test', description: 'test', price: 1, stock: value }).validate(); } }; }
    } });
    const a = response(); await c.updateProductStock({ params: { productId: id }, body: { stock: 1.5 } }, a);
    const b = response(); await c.updateProductStock({ params: { productId: id }, body: { stock: 'invalid' } }, b);
    assert.equal(a.code, 200); assert.equal(b.code, 500);
    return { fractionalStock: a.code, invalidType: b.code, persistence: 'mock only' };
  });
  await check('READ_CONTROLLERS_UNHANDLED_DB_REJECTION', async () => {
    const failure = async () => { throw new Error('synthetic database failure'); };
    const p = load('backend/controllers/productController.js', { '../models/Product': { find: failure } });
    const o = load('backend/controllers/orderController.js', { ...controllerMocks, '../models/Order': { find: failure }, axios: {} });
    const a = response(), b = response();
    await assert.rejects(p.getProducts({}, a)); await assert.rejects(o.getOrders({}, b));
    assert.equal(a.ended, false); assert.equal(b.ended, false);
    return { productReadRejects: true, orderReadRejects: true, errorResponseSent: false, runningServicesAffected: false };
  });
  await check('JWT_AND_ADMIN_CONTROLS', () => {
    const jwt = backendRequire('jsonwebtoken'); const secret = 'audit-only-synthetic-key';
    const c = load('backend/middlewares/authMiddleware.js', {}, { JWT_SECRET: secret });
    function test(token) { const r = response(); let next = false; c.authenticateToken({ headers: token ? { authorization: `Bearer ${token}` } : {} }, r, () => { next = true; }); return { code: r.code, next }; }
    const missing = test(); const invalid = test('invalid.synthetic.token');
    const expired = test(jwt.sign({ userId: id, role: 'user' }, secret, { expiresIn: -1 }));
    const valid = test(jwt.sign({ userId: id, role: 'user' }, secret, { expiresIn: 60 }));
    const forged = test(jwt.sign({ userId: id, role: 'admin' }, 'different-synthetic-key'));
    const admin = response(); c.isAdmin({ user: { role: 'user' } }, admin, () => {});
    assert.equal(missing.code, 401); assert.equal(invalid.code, 403); assert.equal(expired.code, 403);
    assert.equal(forged.code, 403); assert.equal(valid.next, true); assert.equal(admin.code, 403);
    return { missing: 401, invalid: 403, expired: 403, forgedAdmin: 403, validAccepted: true, regularUserAdmin: 403, realSecretsUsed: false };
  });
  await check('DELETE_ROUTE_MISSING_ADMIN', () => {
    const routes = []; const router = Object.fromEntries(['get', 'post', 'delete', 'put'].map(method => [method, (route, ...handlers) => routes.push({ method, route, handlers })]));
    const authenticateToken = () => {}; const isAdmin = () => {};
    load('backend/routes/orderRoutes.js', { express: { Router: () => router }, '../controllers/orderController': {}, '../middlewares/authMiddleware': { authenticateToken, isAdmin } });
    const d = routes.find(x => x.method === 'delete'); assert.equal(d.handlers.includes(isAdmin), false);
    return { route: d.route, authenticated: d.handlers.includes(authenticateToken), adminRequired: false, deletionImplemented: false };
  });
  await check('NOTIFICATION_EXPOSURE_AND_ERROR', async () => {
    const routes = []; let sent = 0;
    const app = { use() {}, post(route, ...handlers) { routes.push({ route, handlers }); }, listen() {} };
    const nodemailer = { createTransport: () => ({ async sendMail() { sent++; throw Object.assign(new Error('synthetic'), { code: 'SYNTHETIC_SMTP_DETAIL' }); } }) };
    load('microservices/notifications/index.js', { express: () => app, 'body-parser': { json: () => () => {} }, dotenv: { config() {} }, nodemailer });
    const r = response(); await routes[0].handlers[0]({ body: { to: 'audit@example.invalid', subject: 'test', text: 'test' } }, r);
    assert.equal(sent, 1); assert.equal(routes[0].handlers.length, 1); assert.equal(r.body.error.code, 'SYNTHETIC_SMTP_DETAIL');
    return { authenticationMiddleware: false, mockedSendReached: true, httpStatus: r.code, errorDetailReturned: true, realEmailSent: false };
  });
  await check('NOTIFICATION_ARBITRARY_FILE_CONTENT', async () => {
    const fixture = path.join(require('os').tmpdir(), 'e27-e28-mail-canary.txt');
    const marker = 'AUDIT_SYNTHETIC_FILE_CONTENT';
    fs.writeFileSync(fixture, marker);
    try {
      const mailRequire = createRequire(path.join(root, 'microservices/notifications/package.json'));
      const transport = mailRequire('nodemailer').createTransport({ streamTransport: true, buffer: true });
      let handler, containsMarker = false;
      const app = { use() {}, post(route, fn) { handler = fn; }, listen() {} };
      load('microservices/notifications/index.js', { express: () => app,
        'body-parser': { json: () => () => {} }, dotenv: { config() {} },
        nodemailer: { createTransport: () => ({ async sendMail(options) {
          const message = await transport.sendMail(options);
          containsMarker = message.message.toString().includes(marker);
        } }) },
      });
      const r = response();
      await handler({ body: { to: 'audit@example.invalid', subject: 'Synthetic audit', text: { path: fixture } } }, r);
      assert.equal(r.code, 200); assert.equal(containsMarker, true);
      return { status: r.code, fileContentInMessage: true, transport: 'in-memory stream only', sensitiveFilesRead: false, realEmailSent: false };
    } finally { fs.unlinkSync(fixture); }
  });
  await check('STOCK_SERVICE_FALSE_SUCCESS', () => {
    let handler; const app = { use() {}, post(route, fn) { handler = fn; }, listen() {} };
    const express = () => app; express.json = () => () => {};
    load('microservices/stock-management/index.js', { express });
    const r = response(); handler({ body: { productId: 'nonexistent', quantity: -999 } }, r);
    assert.equal(r.code, 200); assert.equal(r.ended, true);
    return { status: r.code, invalidInputAccepted: true, databaseAccess: false, authentication: false };
  });
  await check('CART_REDUCER_MUTATION_AND_STOCK', () => {
    const source = fs.readFileSync(path.join(root, 'frontend/src/context/CartContext.js'), 'utf8');
    const reducerSource = source.slice(source.indexOf('export const cartReducer'), source.indexOf('export const CartProvider')).replace('export const cartReducer', 'const cartReducer');
    const context = {}; vm.runInNewContext(reducerSource + '\nthis.reducer = cartReducer;', context);
    const state = { cart: [{ id, quantity: 1, stock: 1, price: 10 }] };
    const next = context.reducer(state, { type: 'ADD_TO_CART', payload: { id, quantity: 1 } });
    assert.equal(state.cart[0].quantity, 2); assert.equal(next.cart[0].quantity, 2);
    return { previousStateMutated: true, quantity: 2, availableStock: 1 };
  });
  await check('SHIPPING_AND_PAYMENT_INITIAL_STATE', () => {
    const context = fs.readFileSync(path.join(root, 'frontend/src/context/CartContext.js'), 'utf8');
    const ship = fs.readFileSync(path.join(root, 'frontend/src/components/ShippingMethodSelection.js'), 'utf8');
    const pay = fs.readFileSync(path.join(root, 'frontend/src/components/handlePaymentChange.js'), 'utf8');
    assert.match(context, /shippingMethod: null/); assert.match(context, /paymentMethod: null/);
    assert.equal(ship.includes('<option value=""'), false); assert.equal(pay.includes('<option value=""'), false);
    return 'Both controlled selects start with null, no placeholder and no initial dispatch; order requires non-null methods';
  });
  // Only reads and rejected requests against running services. No real JWT used.
  for (const [name, url, options] of [
    ['LIVE_PRODUCTS', 'http://127.0.0.1:5000/api/products', {}],
    ['LIVE_ORDERS_UNAUTHENTICATED', 'http://127.0.0.1:5000/api/orders', {}],
    ['LIVE_INVALID_TOKEN', 'http://127.0.0.1:5000/api/orders', { headers: { Authorization: 'Bearer audit.invalid.synthetic' } }],
    ['LIVE_UNKNOWN_ROUTE', 'http://127.0.0.1:5000/api/audit-missing', {}],
    ['LIVE_MALFORMED_JSON', 'http://127.0.0.1:5000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }],
    ['LIVE_CORS', 'http://127.0.0.1:5000/api/products', { method: 'OPTIONS', headers: { Origin: 'https://audit.example.invalid', 'Access-Control-Request-Method': 'GET' } }],
    ['LIVE_NOTIFY_PREFLIGHT', 'http://127.0.0.1:8000/notify', { method: 'OPTIONS' }],
    ['LIVE_AUTH_GATEWAY', 'http://127.0.0.1:8000/auth/login', { method: 'OPTIONS' }],
  ]) await check(name, async () => {
    const r = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
    const text = await r.text(); let extra = {};
    if (name === 'LIVE_PRODUCTS' && r.ok) { const products = JSON.parse(text); extra = { count: products.length, allHaveMongoId: products.every(p => Boolean(p._id)), anyHaveId: products.some(p => Boolean(p.id)) }; }
    if (name === 'LIVE_MALFORMED_JSON') extra = { contentType: r.headers.get('content-type'), exposesStack: text.includes('SyntaxError') && text.includes('node_modules'), exposesAbsolutePath: /[A-Z]:\\|[A-Z]:&#92;/.test(text) };
    return { status: r.status, cors: r.headers.get('access-control-allow-origin'), allow: r.headers.get('allow'), ...extra };
  });
  fs.writeFileSync(path.join(__dirname, 'probes.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => r.outcome === 'probe failed')) process.exitCode = 1;
}
main().catch(() => { console.error('Audit harness failed (details suppressed)'); process.exitCode = 1; });
