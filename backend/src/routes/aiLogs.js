const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const ctrl = require('../controllers/aiLogsController');

router.get('/', authenticate, authorize('admin'), ctrl.getLogs);

module.exports = router;
