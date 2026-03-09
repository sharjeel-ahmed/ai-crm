const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/emailAccountsController');

router.get('/auth-url', authenticate, ctrl.getAuthUrl);
router.get('/callback', ctrl.handleCallback); // No auth — Google redirects here
router.get('/', authenticate, ctrl.getAll);
router.delete('/:id', authenticate, ctrl.remove);
router.post('/:id/sync', authenticate, ctrl.syncNow);
router.post('/:id/resync', authenticate, ctrl.resync);

module.exports = router;
