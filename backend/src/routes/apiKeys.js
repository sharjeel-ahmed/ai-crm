const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { createKey, listKeys, revokeKey } = require('../controllers/apiKeysController');

router.use(authenticate);

router.post('/', createKey);
router.get('/', listKeys);
router.delete('/:id', revokeKey);

module.exports = router;
