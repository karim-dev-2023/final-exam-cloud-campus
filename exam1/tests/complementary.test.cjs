const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { createRequire } = require('node:module');
const backendRequire = createRequire(path.resolve(__dirname, '../backend/package.json'));
const mailRequire = createRequire(path.resolve(__dirname, '../microservices/notifications/package.json'));
const mongoose = backendRequire('mongoose');
const User = require('../backend/models/User');
const Product = require('../backend/models/Product');
const Order = require('../backend/models/Order');
const Attempt = require('../backend/models/CheckoutAttempt');
const { createBackendApp } = require('../backend/app');
const { createStockApp } = require('../microservices/stock-management/app');
const { createNotificationApp } = require('../microservices/notifications/app');
const { createGatewayApp } = require('../gateway/app');
const password = 'Synthetic-password-2026';
const database = `complement_test_${randomBytes(8).toString('hex')}`;
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
async function stockOf(p) { return (await Product.findById(p._id)).stock; }

before(async () => {
  console.log = () => {}; console.error = () => {};
  process.env.JWT_SECRET = randomBytes(32).toString('base64url');
  process.env.NOTIFICATION_SERVICE_TOKEN = randomBytes(32).toString('base64url');
  process.env.DEBUG = '';
  assert.match(database, /^complement_test_[0-9a-f]{16}$/);
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
  base = await listen(createBackendApp({ authLimit: { max: 1000 } }));
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
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database && /^complement_test_[0-9a-f]{16}$/.test(database)) await mongoose.connection.dropDatabase();
  } finally { await mongoose.disconnect(); console.log = oldLog; console.error = oldError; }
});


const jwt = backendRequire('jsonwebtoken');
function adminToken() { return jwt.sign({ userId: String(user._id), role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' }); }
async function savedOrder(status = 'En attente') {
  const p = await product();
  return Order.create({ ...orderBody([{ productId: p._id, quantity: 1, price: 20 }]), userId: user._id, total: 20, status });
}
test('Complement: DELETE requires admin and terminal orders are archived, never resurrected by replay', async () => {
  const p = await product();
  const key = randomUUID();
  const created = await api('orders', orderBody([{ productId: String(p._id), quantity: 1 }]), token, 'POST', key);
  assert.equal(created.status, 201); const id = (await created.json()).order._id;
  assert.equal((await api('orders/' + id, undefined, token, 'DELETE')).status, 403);
  assert.equal((await api('orders/' + id, undefined, adminToken(), 'DELETE')).status, 409);
  assert.equal((await api('orders/' + id + '/status', {status:'Annulée'}, adminToken(), 'PUT')).status, 200);
  assert.equal((await api('orders/' + id, undefined, adminToken(), 'DELETE')).status, 204);
  assert.equal((await api('orders/' + id, undefined, adminToken(), 'DELETE')).status, 404);
  assert.equal((await (await api('orders', undefined, adminToken())).json()).length, 0);
  const replay = await api('orders', orderBody([{productId:String(p._id),quantity:1}]), token, 'POST', key);
  assert.equal(replay.status, 200); assert.equal((await replay.json()).order._id, id);
  assert.equal(await Order.countDocuments(), 1); assert.equal(await stockOf(p), 4);
  assert.equal((await (await api('orders', undefined, adminToken())).json()).length, 0);
});
test('Complement: validation persists URL id; invalid ids and missing orders never report success', async () => {
  const o = await savedOrder();
  assert.equal((await api('orders/' + o._id + '/validate', {}, adminToken(), 'PUT')).status, 200);
  assert.equal((await Order.findById(o._id)).status, 'En cours de traitement');
  assert.equal((await api('orders/' + o._id + '/validate', {}, adminToken(), 'PUT')).status, 200);
  assert.equal((await api('orders/not-an-id/validate', {}, adminToken(), 'PUT')).status, 400);
  assert.equal((await api('orders/' + new mongoose.Types.ObjectId() + '/validate', {}, adminToken(), 'PUT')).status, 404);
  assert.equal((await api('orders/not-an-id', undefined, adminToken(), 'DELETE')).status, 400);
  assert.equal((await api('orders/' + new mongoose.Types.ObjectId(), undefined, adminToken(), 'DELETE')).status, 404);
});
test('Complement: enum, forward transitions and terminal states are enforced atomically', async () => {
  const o = await savedOrder(); const route = 'orders/' + o._id + '/status';
  for (const status of ['arbitrary', {$ne:null}, null, 42]) assert.equal((await api(route, {status}, adminToken(), 'PUT')).status, 400);
  assert.equal((await api(route, {status:'Expédiée'}, adminToken(), 'PUT')).status, 409);
  for (const status of ['En cours de traitement','Expédiée','Délivrée']) assert.equal((await api(route, {status}, adminToken(), 'PUT')).status, 200);
  assert.equal((await api(route, {status:'Annulée'}, adminToken(), 'PUT')).status, 409);
  assert.equal((await Order.findById(o._id)).status, 'Délivrée');
  const concurrent = await savedOrder();
  const replies = await Promise.all(['En cours de traitement','Annulée'].map(status=>api('orders/'+concurrent._id+'/status',{status},adminToken(),'PUT')));
  assert.ok(replies.some(r=>r.status===200));
  assert.ok(['En cours de traitement','Annulée'].includes((await Order.findById(concurrent._id)).status));
});
test('Complement: database read and update failures return sanitized JSON and process stays alive', async () => {
  for (const [model, method, route, body, verb] of [[Order,'find','orders',undefined,'GET'],[Product,'find','products',undefined,'GET'],[Order,'findOne','orders/'+new mongoose.Types.ObjectId()+'/validate',{},'PUT']]) {
    const original=model[method]; model[method]=()=>{throw new Error('synthetic-private-path-and-password');};
    try { const r=await api(route,body,adminToken(),verb); assert.equal(r.status,500); assert.deepEqual(await r.json(),{message:'Erreur serveur.'}); }
    finally {model[method]=original;}
  }
  assert.equal((await api('products')).status,200);
});
test('Complement: malformed and oversized JSON never expose Express stacks', async () => {
  for (const [body,status] of [['{',400], [JSON.stringify({username:'x'.repeat(40000)}),413]]) {
    const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body});
    assert.equal(r.status,status); assert.match(r.headers.get('content-type'),/application\/json/);
    assert.deepEqual(await r.json(),{message:'Requête invalide.'});
  }
});
test('Complement: CORS allows the local frontend and never grants unknown origins', async () => {
  for (const [origin,allowed] of [['http://localhost:3000',true],['https://untrusted.example.invalid',false]]) {
    const r=await fetch(base+'/api/products',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'}});
    assert.equal(r.headers.get('access-control-allow-origin'),allowed?origin:null);
  }
  assert.equal((await api('products')).status,200);
});
test('Complement: JWT signature, expiration, algorithm, claims and admin authorization', async () => {
  const claims={userId:String(user._id),role:'admin'};
  const bad=[jwt.sign(claims,'wrong-key',{expiresIn:'1h'}),jwt.sign(claims,process.env.JWT_SECRET,{expiresIn:-1}),
    jwt.sign(claims,process.env.JWT_SECRET,{algorithm:'HS384',expiresIn:'1h'}),jwt.sign({role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'}),jwt.sign(claims,process.env.JWT_SECRET)];
  for(const auth of bad) assert.equal((await api('orders',undefined,auth)).status,403);
  assert.equal((await api('orders',undefined,null)).status,401);
  assert.equal((await api('orders')).status,403);
  assert.equal((await api('orders',undefined,adminToken())).status,200);
  const identity=await (await api('auth/me')).json();assert.equal(identity.role,'user');
});
test('Complement: source/account rate limits return 429 and recover after expiry', async () => {
  let time=0;
  const isolated=await listen(createBackendApp({authLimit:{max:2,windowMs:1000,now:()=>time}}));
  const login=()=>fetch(isolated+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'absent',password:'Synthetic-password-2026'})});
  assert.equal((await login()).status,401);assert.equal((await login()).status,401);
  const denied=await login();assert.equal(denied.status,429);assert.ok(denied.headers.get('retry-after'));
  time=1001;assert.equal((await login()).status,401);
});
test('Complement: stock validates ids, integer boundaries and returns proper client errors', async () => {
  const p=await product();const route='products/'+p._id+'/stock';
  for(const stock of [1.5,-1,null,{},'wrong',Number.MAX_SAFE_INTEGER+1]) assert.equal((await api(route,{stock},adminToken(),'PUT')).status,400);
  for(const stock of [0,1,'2']) {assert.equal((await api(route,{stock},adminToken(),'PUT')).status,200);assert.equal(await stockOf(p),Number(stock));}
  assert.equal((await api('products/not-an-id/stock',{stock:1},adminToken(),'PUT')).status,400);
});
test('Complement: notification timeout bounds an unresponsive transport', async () => {
  const express=backendRequire('express');const hung=express();hung.post('/notify',()=>{});
  const url=await listen(hung),before=Date.now();
  await assert.rejects(require('../backend/services/notificationService').sendNotification({to:'test@example.invalid',subject:'Test',text:'Test'},
    {env:{NOTIFICATION_SERVICE_TOKEN:process.env.NOTIFICATION_SERVICE_TOKEN,NOTIFICATION_GATEWAY_URL:url}}),error=>error.code==='ECONNABORTED');
  assert.ok(Date.now()-before>=9000);assert.ok(Date.now()-before<13000);
});

test('Complement: synthetic passwords and JWT never appear in authentication logs', async () => {
  const messages=[],log=console.log,error=console.error;
  console.log=(...args)=>messages.push(args.join(' '));console.error=(...args)=>messages.push(args.join(' '));
  try {
    const response=await api('auth/login',{username:user.username,password},null);
    assert.equal(response.status,200);const identity=await response.json();
    assert.equal((await api('orders',undefined,identity.token)).status,403);
    assert.equal((await api('orders',undefined,adminToken())).status,200);
    assert.equal((await api('orders',undefined,'synthetic-private-token')).status,403);
    const output=messages.join(' ');
    for(const marker of [password,identity.token,'synthetic-private-token']) assert.equal(output.includes(marker),false);
  } finally {console.log=log;console.error=error;}
});
