const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/emailAccountsController');

router.get('/auth-url', authenticate, authorize('admin'), ctrl.getAuthUrl);
router.get('/callback', ctrl.handleCallback); // No auth — Google redirects here
router.get('/', authenticate, authorize('admin'), ctrl.getAll);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);
router.post('/:id/sync', authenticate, authorize('admin'), ctrl.syncNow);
router.post('/:id/resync', authenticate, authorize('admin'), ctrl.resync);

module.exports = router;
