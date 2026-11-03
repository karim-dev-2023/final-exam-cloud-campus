// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { validUsername, validEmail, validPassword } = require('../validation/authValidation');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, validate: validUsername },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, validate: validEmail },
  password: { type: String, required: true, validate: function (value) {
    return !this.isModified('password') || validPassword(value);
  } },
  role: { type: String, default: 'user' }, // Peut être 'user' ou 'admin'
});

// Middleware pour hasher le mot de passe avant sauvegarde
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);
