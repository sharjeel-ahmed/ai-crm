const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/ignoreListController');

router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, ctrl.add);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
