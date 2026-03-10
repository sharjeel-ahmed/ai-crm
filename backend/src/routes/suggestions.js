const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/suggestionsController');

router.get('/', authenticate, authorize('admin'), ctrl.getAll);
router.get('/stats', authenticate, authorize('admin'), ctrl.getStats);
router.post('/:id/approve', authenticate, authorize('admin'), ctrl.approve);
router.post('/:id/approve-with-edits', authenticate, authorize('admin'), ctrl.approveWithEdits);
router.post('/:id/dismiss', authenticate, authorize('admin'), ctrl.dismiss);
router.post('/bulk-approve', authenticate, authorize('admin'), ctrl.bulkApprove);
router.post('/bulk-dismiss', authenticate, authorize('admin'), ctrl.bulkDismiss);

module.exports = router;
