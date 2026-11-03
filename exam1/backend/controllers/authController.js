const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validUsername, validEmail, validPassword } = require('../validation/authValidation');
require('dotenv').config();

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  // Validate BEFORE constructing any database filter. Keep legacy passwords usable.
  if (typeof username !== 'string' || !username.trim() || username.length > 1024 ||
      typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 1024) {
    return res.status(400).json({ message: 'Identifiants invalides.' });
  }
  try {
    const user = await User.findOne({ username: { $in: [...new Set([username, username.trim()])] } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token, role: user.role, username: user.username });
  } catch {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!validUsername(username) || typeof email !== 'string' || !validEmail(email.trim()) || !validPassword(password)) {
    return res.status(400).json({ message: 'Inscription invalide : nom de 3 à 50 caractères, email valide, mot de passe de 12 caractères minimum avec majuscule, minuscule et chiffre (72 octets maximum).' });
  }
  const identity = { username: username.trim(), email: email.trim().toLowerCase() };
  try {
    const exists = await User.findOne({ $or: [{ username: identity.username }, { email: identity.email }] }).collation({ locale: 'en', strength: 2 });
    if (exists) return res.status(409).json({ message: 'Nom ou email déjà utilisé.' });
    // Never accept a role supplied by the caller.
    const user = new User({ ...identity, password });
    await user.save();
    return res.status(201).json({ message: 'Utilisateur créé avec succès.' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Nom ou email déjà utilisé.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Inscription invalide.' });
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};
