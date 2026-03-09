const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/aiLogsController');

router.get('/', authenticate, ctrl.getLogs);

module.exports = router;
