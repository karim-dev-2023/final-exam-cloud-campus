const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  state: { type: String, enum: ['reserving', 'committed', 'completed', 'compensating', 'failed'], required: true },
  order: { type: mongoose.Schema.Types.Mixed, required: true },
  reserveUntil: { type: Date, required: true },
  keyHash: { type: String, unique: true, sparse: true },
  fingerprint: { type: String, required: true },
  cleanupDone: { type: Boolean, default: false },
}, { timestamps: true, writeConcern: { w: 'majority', j: true } });
schema.index({ state: 1, reserveUntil: 1 });
module.exports = mongoose.model('CheckoutAttempt', schema);
