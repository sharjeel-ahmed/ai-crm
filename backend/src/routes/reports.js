const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/reportsController');

const router = Router();
router.use(authenticate);
router.get('/dashboard', c.dashboard);
router.get('/funnel-dashboard', c.funnelDashboard);
router.get('/summary', c.getSummary);
router.get('/pipeline-value', c.pipelineValue);
router.get('/rep-performance', c.repPerformance);
router.get('/deal-aging', c.dealAging);
router.get('/attention', c.attention);
router.get('/targets', c.getTargets);
router.post('/targets', c.setTarget);

module.exports = router;
