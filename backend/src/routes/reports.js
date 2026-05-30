const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const c = require('../controllers/reportsController');

const router = Router();
router.use(authenticate);
router.get('/dashboard', c.dashboard);
router.get('/funnel-dashboard', c.funnelDashboard);
router.get('/summary', c.getSummary);
router.get('/gong-analytics', c.gongAnalytics);
router.get('/pipeline-value', c.pipelineValue);
router.get('/rep-performance', c.repPerformance);
router.get('/deal-aging', c.dealAging);
router.get('/attention', c.attention);
router.get('/targets', authorize('admin', 'manager'), c.getTargets);
router.post('/targets', authorize('admin', 'manager'), c.setTarget);

module.exports = router;
