// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0, validate: Number.isFinite },
  description: { type: String, required: true },
  stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  // Internal, bounded in time; kept until the checkout lease expires to fence late retries.
  reservations: { type: [{ _id: false, checkoutId: mongoose.Schema.Types.ObjectId,
    quantity: Number, state: { type: String, enum: ['held', 'released'] } }], select: false, default: undefined },
}, {
  writeConcern: { w: 'majority', j: true },
  timestamps: true, // Ajoute createdAt et updatedAt
});

module.exports = mongoose.model('Product', productSchema);
