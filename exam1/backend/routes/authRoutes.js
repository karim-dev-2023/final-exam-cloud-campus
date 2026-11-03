// backend/routes/authRoutes.js
const express = require('express');
const { login, register } = require('../controllers/authController');

const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();
router.get('/me', authenticateToken, (req, res) => res.json({ userId: req.user.userId, role: req.user.role }));

router.post('/login', login);
router.post('/register', register);

module.exports = router;
