const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/aiLogsController');

router.get('/', authenticate, authorize('admin'), ctrl.getLogs);
router.post('/:id/retry', authenticate, authorize('admin'), ctrl.retryLog);
router.delete('/:id/from-here', authenticate, authorize('admin'), ctrl.deleteFromHere);
router.delete('/:id', authenticate, authorize('admin'), ctrl.deleteLog);

module.exports = router;
