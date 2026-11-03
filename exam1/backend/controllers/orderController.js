const { sendNotification } = require('../services/notificationService');
const { createCheckout, CheckoutError } = require('../services/checkoutService');
const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
  try {
    const { order, replayed } = await createCheckout(req.body, req.user.userId, req.get('Idempotency-Key'));
    if (!replayed) {
      try {
        await sendNotification({
          to: process.env.ORDER_NOTIFICATION_EMAIL,
          subject: 'Nouvelle Commande Créée',
          text: `Une commande a été créée pour les produits suivants :\n${order.items.map(item => `Produit ID : ${item.productId}, Quantité : ${item.quantity}`).join('\n')}`,
        });
      } catch { console.error('Erreur lors de l’envoi de la notification.'); }
    }
    return res.status(replayed ? 200 : 201).json({ message: 'Commande créée avec succès', order, replayed });
  } catch (error) {
    const status = error instanceof CheckoutError ? error.status : 503;
    return res.status(status).json({
      message: error instanceof CheckoutError ? error.message : 'Commande indisponible. Veuillez réessayer.',
      ...(error.checkoutId ? { checkoutId: error.checkoutId } : {}),
      ...(error.checkoutState ? { checkoutState: error.checkoutState } : {}),
    });
  }
};


const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const transitions = {
  'En attente': ['En cours de traitement', 'Annulée'],
  'En cours de traitement': ['Expédiée', 'Annulée'],
  'Expédiée': ['Délivrée'], 'Délivrée': [], 'Annulée': [],
};
exports.getOrders = async (req, res, next) => {
  try { return res.json(await Order.find({ deletedAt: null })); } catch (error) { return next(error); }
};
async function changeStatus(req, res, next, status) {
  const id = req.params.orderId || req.params.id;
  if (!validId(id) || typeof status !== 'string' || !Object.hasOwn(transitions, status)) {
    return res.status(400).json({ message: 'Identifiant ou statut invalide.' });
  }
  try {
    const order = await Order.findOne({ _id: id, deletedAt: null });
    if (!order) return res.status(404).json({ message: 'Commande non trouvée.' });
    if (order.status === status) return res.json({ message: 'Statut inchangé.', order });
    if (!transitions[order.status]?.includes(status)) return res.status(409).json({ message: 'Transition de statut interdite.' });
    const updated = await Order.findOneAndUpdate({ _id: id, status: order.status, deletedAt: null },
      { $set: { status } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ message: 'Commande modifiée simultanément. Rechargez la liste.' });
    return res.json({ message: 'Statut mis à jour.', order: updated });
  } catch (error) { return next(error); }
}
exports.validateOrder = (req, res, next) => changeStatus(req, res, next, 'En cours de traitement');
exports.updateOrderStatus = (req, res, next) => changeStatus(req, res, next, req.body?.status);
exports.deleteOrder = async (req, res, next) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide.' });
  try {
    // Preserve the record for checkout recovery and idempotent replays.
    const order = await Order.findOneAndUpdate({ _id: req.params.id, deletedAt: null,
      status: { $in: ['Délivrée', 'Annulée'] } }, { $set: { deletedAt: new Date() } }, { new: true, runValidators: true });
    if (order) return res.status(204).end();
    const exists = await Order.exists({ _id: req.params.id, deletedAt: null });
    return res.status(exists ? 409 : 404).json({ message: exists ? 'Terminez ou annulez la commande avant suppression.' : 'Commande non trouvée.' });
  } catch (error) { return next(error); }
};
