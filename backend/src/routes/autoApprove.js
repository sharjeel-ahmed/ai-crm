const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/autoApproveController');

router.get('/', authenticate, authorize('admin'), ctrl.getRules);
router.put('/', authenticate, authorize('admin'), ctrl.updateRule);

module.exports = router;
