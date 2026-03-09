const { Router } = require('express');
const { login, getMe, updateMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);

module.exports = router;
