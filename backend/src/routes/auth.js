const { Router } = require('express');
const { login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.post('/login', login);
router.get('/me', authenticate, getMe);

module.exports = router;
