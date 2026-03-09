const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/reportsController');

const router = Router();
router.use(authenticate);
router.get('/dashboard', c.dashboard);
router.get('/pipeline-value', c.pipelineValue);
router.get('/rep-performance', c.repPerformance);
router.get('/deal-aging', c.dealAging);

module.exports = router;
