const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Isolate the controller: no MongoDB connection, HTTP request or email is sent.
const checkoutPath = require.resolve('../backend/services/checkoutService');
const notificationPath = require.resolve('../backend/services/notificationService');
const orderPath = require.resolve('../backend/models/Order');
const originalLoad = Module._load;
const originalRecipient = process.env.ORDER_NOTIFICATION_EMAIL;
let checkoutResult, notificationError;
const notifications = [];
class CheckoutError extends Error { constructor(message, status) { super(message); this.status = status; } }
let createOrder;
try {
  Module._load = function (request, parent, isMain) {
    const resolved = Module._resolveFilename(request, parent);
    if (resolved === checkoutPath) return { CheckoutError, async createCheckout() {
      if (checkoutResult instanceof Error) throw checkoutResult;
      return checkoutResult;
    } };
    if (resolved === notificationPath) return { async sendNotification(payload) {
      notifications.push(payload);
      if (notificationError) throw notificationError;
    } };
    if (resolved === orderPath) return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  ({ createOrder } = require('../backend/controllers/orderController'));
} finally { Module._load = originalLoad; }

after(() => {
  if (originalRecipient === undefined) delete process.env.ORDER_NOTIFICATION_EMAIL;
  else process.env.ORDER_NOTIFICATION_EMAIL = originalRecipient;
});

async function invoke(replayed = false) {
  notifications.length = 0;
  notificationError = undefined;
  checkoutResult = { order: { items: [{ productId: 'synthetic-product', quantity: 2 }] }, replayed };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { body: {}, user: { userId: 'synthetic-user' }, get() { return 'synthetic-idempotency-key'; } };
  return { req, res };
}

test('Order notification uses the configured recipient and preserves the order response', async () => {
  for (const recipient of ['orders@example.invalid', 'other-orders@example.invalid']) {
    process.env.ORDER_NOTIFICATION_EMAIL = recipient;
    const { req, res } = await invoke();
    await createOrder(req, res);
    assert.equal(res.code, 201);
    assert.equal(res.body.replayed, false);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].to, recipient);
    assert.match(notifications[0].text, /synthetic-product, Quantité : 2/);
  }
});

test('Idempotent replay returns 200 without sending another notification', async () => {
  const { req, res } = await invoke(true);
  await createOrder(req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.replayed, true);
  assert.equal(notifications.length, 0);
});

test('A missing recipient and notification failure do not roll back the created order', async () => {
  delete process.env.ORDER_NOTIFICATION_EMAIL;
  const { req, res } = await invoke();
  notificationError = new Error('Synthetic invalid recipient');
  const originalError = console.error;
  try { console.error = () => {}; await createOrder(req, res); }
  finally { console.error = originalError; }
  assert.equal(res.code, 201);
  assert.equal(notifications[0].to, undefined);
  assert.equal(res.body.order, checkoutResult.order);
});

test('Checkout errors retain their status and never trigger a notification', async () => {
  const { req, res } = await invoke();
  checkoutResult = new CheckoutError('Synthetic checkout conflict', 409);
  await createOrder(req, res);
  assert.equal(res.code, 409);
  assert.equal(res.body.message, checkoutResult.message);
  assert.equal(notifications.length, 0);
});
