const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Attempt = require('../models/CheckoutAttempt');
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
class CheckoutError extends Error {
  constructor(status, message, checkoutId) { super(message); this.status = status; this.checkoutId = checkoutId; }
}
const expired = { $lte: ['$reserveUntil', '$$NOW'] };

function normalize(body, userId) {
  if (!objectIdPattern.test(String(userId))) throw new CheckoutError(403, 'Identité invalide.');
  if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) {
    throw new CheckoutError(400, 'Le panier doit contenir de 1 à 100 lignes.');
  }
  const quantities = new Map();
  for (const item of body.items) {
    if (!item || typeof item.productId !== 'string' || !objectIdPattern.test(item.productId) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
      throw new CheckoutError(400, 'Identifiant produit ou quantité invalide.');
    }
    const id = item.productId.toLowerCase();
    const quantity = (quantities.get(id) || 0) + item.quantity;
    if (quantity > 10000) throw new CheckoutError(400, 'Quantité cumulée trop élevée.');
    quantities.set(id, quantity);
  }
  const address = body.shippingAddress;
  if (!address || Array.isArray(address) || typeof address !== 'object') throw new CheckoutError(400, 'Adresse requise.');
  const shippingAddress = {};
  for (const key of ['street', 'city', 'postalCode', 'country']) {
    if (typeof address[key] !== 'string' || !address[key].trim() || address[key].length > 200) throw new CheckoutError(400, 'Adresse invalide.');
    shippingAddress[key] = address[key].trim();
  }
  if (!['Carte bancaire', 'PayPal', 'Virement'].includes(body.paymentMethod) || !['colissimo', 'chronopost'].includes(body.shippingMethod)) {
    throw new CheckoutError(400, 'Méthode de livraison ou paiement invalide.');
  }
  return { userId: String(userId), items: [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([productId, quantity]) => ({ productId, quantity })),
    shippingAddress, paymentMethod: body.paymentMethod, shippingMethod: body.shippingMethod };
}

async function reserveCheckoutItem(checkoutId, productId, quantity) {
  if (![checkoutId, productId].every(id => typeof id === 'string' && objectIdPattern.test(id)) || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new CheckoutError(400, 'Réservation invalide.');
  }
  const attempt = await Attempt.findById(checkoutId);
  const item = attempt?.order.items.find(line => String(line.productId) === productId.toLowerCase());
  if (!attempt || attempt.state !== 'reserving' || !item || item.quantity !== quantity) throw new CheckoutError(409, 'Réservation non autorisée pour cette commande.');
  const id = attempt._id;
  const product = await Product.findOneAndUpdate({ _id: productId, price: item.price, stock: { $gte: quantity },
    'reservations.checkoutId': { $ne: id }, $expr: { $lt: ['$$NOW', attempt.reserveUntil] } }, {
    $inc: { stock: -quantity }, $push: { reservations: { checkoutId: id, quantity, state: 'held' } },
  }, { new: true, runValidators: true });
  if (product) return product;
  // A retry may see the same reservation after an acknowledgement was lost.
  const existing = await Product.findById(productId).select('+reservations');
  const marker = existing?.reservations?.find(entry => String(entry.checkoutId) === checkoutId);
  if (marker?.state === 'held' && marker.quantity === quantity) return existing;
  throw new CheckoutError(409, 'Stock insuffisant, prix modifié ou réservation expirée.');
}

async function compensate(attempt) {
  for (const item of attempt.order.items) {
    const filter = { _id: item.productId, 'reservations.checkoutId': { $ne: attempt._id }, $expr: { $lt: ['$$NOW', attempt.reserveUntil] } };
    // Fence a late/in-flight reservation even for an item not reserved yet.
    await Product.updateOne(filter, { $push: { reservations: { checkoutId: attempt._id, quantity: item.quantity, state: 'released' } } });
    // Marker and increment change in ONE write; replay cannot refund twice.
    await Product.updateOne({ _id: item.productId, reservations: { $elemMatch: { checkoutId: attempt._id, state: 'held' } } }, {
      $inc: { stock: item.quantity }, $set: { 'reservations.$.state': 'released' },
    });
  }
  await Attempt.updateOne({ _id: attempt._id, state: 'compensating' }, { $set: { state: 'failed' } });
}

async function materialize(attempt) {
  const order = new Order({ ...attempt.order, _id: attempt._id });
  await order.validate();
  try {
    await Order.updateOne({ _id: attempt._id }, { $setOnInsert: order.toObject() }, { upsert: true, runValidators: true, timestamps: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  await Attempt.updateOne({ _id: attempt._id, state: 'committed' }, { $set: { state: 'completed' } });
  return Order.findById(attempt._id);
}

async function recoverCheckout(checkoutId) {
  await Attempt.updateOne({ _id: checkoutId, state: 'reserving', $expr: expired }, { $set: { state: 'compensating' } });
  const attempt = await Attempt.findById(checkoutId);
  if (!attempt) return null;
  let order;
  if (attempt.state === 'compensating') await compensate(attempt);
  if (['committed', 'completed'].includes(attempt.state)) order = await materialize(attempt);
  // Never remove the fencing markers until no delayed reservation can succeed.
  const cleanable = await Attempt.findOne({ _id: checkoutId, state: { $in: ['completed', 'failed'] }, cleanupDone: false, $expr: expired });
  if (cleanable) {
    for (const item of cleanable.order.items) await Product.updateOne({ _id: item.productId }, { $pull: { reservations: { checkoutId: cleanable._id } } });
    await Attempt.updateOne({ _id: checkoutId }, { $set: { cleanupDone: true } });
  }
  return order;
}

async function recoverCheckouts() {
  const pending = await Attempt.find({ $or: [
    { state: { $in: ['committed', 'compensating'] } },
    { state: 'reserving', $expr: expired },
    { state: { $in: ['completed', 'failed'] }, cleanupDone: false, $expr: expired },
  ] }).sort({ updatedAt: 1 }).limit(100).select('_id');
  for (const attempt of pending) {
    try { await recoverCheckout(attempt._id); }
    catch {
      // Move a repeatedly failing job behind others, retaining its durable state.
      await Attempt.updateOne({ _id: attempt._id }, { $set: { updatedAt: new Date() } });
    }
  }
}

function startCheckoutRecovery(logger = console, intervalMs = 10000) {
  let active = null;
  const tick = () => {
    if (active) return;
    active = recoverCheckouts().catch(() => logger.error('Reprise des commandes différée.'))
      .finally(() => { active = null; });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return async () => { clearInterval(timer); if (active) await active; };
}

async function createCheckout(body, userId, idempotencyKey) {
  const normalized = normalize(body, userId);
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey))) throw new CheckoutError(400, 'Clé de requête invalide.');
  const fingerprint = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const keyHash = idempotencyKey ? createHash('sha256').update(`${userId}:${idempotencyKey}`).digest('hex') : undefined;
  async function replay(attempt) {
    if (attempt.fingerprint !== fingerprint) throw new CheckoutError(409, 'Cette clé correspond à un autre panier.', String(attempt._id));
    const order = await recoverCheckout(attempt._id);
    if (order) return { order, replayed: true };
    const current = await Attempt.findById(attempt._id);
    const error = new CheckoutError(409, current?.state === 'failed' ? 'Cette tentative a été annulée. Vous pouvez réessayer.' : 'Commande en cours de traitement. Réessayez dans quelques instants.', String(attempt._id));
    if (current?.state === 'failed') error.checkoutState = 'failed';
    throw error;
  }
  if (keyHash) {
    const previous = await Attempt.findOne({ keyHash });
    if (previous) return replay(previous);
  }
  const products = await Product.find({ _id: { $in: normalized.items.map(item => item.productId) } });
  const byId = new Map(products.map(product => [String(product._id), product]));
  let cents = 0;
  const items = normalized.items.map(item => {
    const product = byId.get(item.productId);
    if (!product) throw new CheckoutError(404, 'Produit inexistant.');
    const unit = Math.round(product.price * 100);
    if (!Number.isFinite(product.price) || product.price < 0 || !Number.isSafeInteger(unit) || Math.abs(unit / 100 - product.price) > 1e-8 || !Number.isSafeInteger(product.stock) || product.stock < 0) {
      throw new CheckoutError(409, 'Données catalogue invalides.');
    }
    cents += unit * item.quantity;
    if (!Number.isSafeInteger(cents)) throw new CheckoutError(400, 'Montant trop élevé.');
    return { productId: product._id, quantity: item.quantity, price: unit / 100 };
  });
  const data = { ...normalized, items, total: cents / 100 };
  await new Order(data).validate();
  let attempt;
  try {
    attempt = await Attempt.create({ _id: new mongoose.Types.ObjectId(), state: 'reserving', order: data,
      reserveUntil: new Date(Date.now() + 30000), fingerprint, ...(keyHash ? { keyHash } : {}) });
  } catch (error) {
    if (error.code === 11000 && keyHash) return replay(await Attempt.findOne({ keyHash }));
    throw error;
  }
  try {
    for (const item of items) await reserveCheckoutItem(String(attempt._id), String(item.productId), item.quantity);
    const committed = await Attempt.findOneAndUpdate({ _id: attempt._id, state: 'reserving', $expr: { $gt: ['$reserveUntil', '$$NOW'] } }, { $set: { state: 'committed' } }, { new: true });
    if (!committed) throw new CheckoutError(409, 'Réservation expirée.');
    const order = await materialize(committed);
    return { order, replayed: false };
  } catch (error) {
    try {
      // An ambiguous commit acknowledgement MUST NOT trigger a stock refund.
      await Attempt.updateOne({ _id: attempt._id, state: 'reserving' }, { $set: { state: 'compensating' } });
      const order = await recoverCheckout(attempt._id);
      if (order) return { order, replayed: false };
    } catch {
      throw new CheckoutError(503, 'Commande en cours de reprise. Réessayez dans quelques instants sans modifier le panier.', String(attempt._id));
    }
    const rejected = error instanceof CheckoutError ? error : new CheckoutError(503, 'Commande annulée après échec de réservation.', String(attempt._id));
    rejected.checkoutState = 'failed';
    throw rejected;
  }
}

module.exports = { CheckoutError, createCheckout, reserveCheckoutItem, recoverCheckout, recoverCheckouts, startCheckoutRecovery };
