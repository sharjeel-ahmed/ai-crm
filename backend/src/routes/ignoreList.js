const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/ignoreListController');

router.get('/', authenticate, authorize('admin'), ctrl.getAll);
router.post('/', authenticate, authorize('admin'), ctrl.add);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

module.exports = router;
