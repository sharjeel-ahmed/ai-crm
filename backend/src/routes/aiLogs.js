const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/aiLogsController');

router.get('/', authenticate, authorize('admin'), ctrl.getLogs);
router.delete('/:id', authenticate, authorize('admin'), ctrl.deleteLog);
router.delete('/:id/before', authenticate, authorize('admin'), ctrl.deleteBefore);

module.exports = router;
