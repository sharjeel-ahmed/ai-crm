const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { isGlobalAdmin } = require('../utils/tenant');
const c = require('../controllers/dbViewerController');

const router = Router();
router.use(authenticate, authorize('admin'));
router.use((req, res, next) => {
  if (!isGlobalAdmin(req.user)) {
    return res.status(403).json({ error: 'Only global admins can view the database' });
  }
  next();
});

router.get('/tables', c.listTables);
router.get('/tables/:name', c.getTableData);

module.exports = router;
