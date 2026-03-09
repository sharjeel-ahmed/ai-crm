const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/aiSettingsController');

router.get('/', authenticate, authorize('admin'), ctrl.get);
router.put('/', authenticate, authorize('admin'), ctrl.update);
router.get('/prompt', authenticate, authorize('admin'), ctrl.getPrompt);
router.put('/prompt', authenticate, authorize('admin'), ctrl.updatePrompt);
router.post('/test', authenticate, authorize('admin'), ctrl.testConnection);

module.exports = router;
