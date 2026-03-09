const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/suggestionsController');

router.get('/', authenticate, ctrl.getAll);
router.get('/stats', authenticate, ctrl.getStats);
router.post('/:id/approve', authenticate, ctrl.approve);
router.post('/:id/approve-with-edits', authenticate, ctrl.approveWithEdits);
router.post('/:id/dismiss', authenticate, ctrl.dismiss);
router.post('/bulk-approve', authenticate, ctrl.bulkApprove);
router.post('/bulk-dismiss', authenticate, ctrl.bulkDismiss);

module.exports = router;
