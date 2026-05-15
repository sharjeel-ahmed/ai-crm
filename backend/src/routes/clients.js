const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { isGlobalAdmin } = require('../utils/tenant');
const c = require('../controllers/clientsController');

const router = Router();
router.use(authenticate, authorize('admin'));
router.use((req, res, next) => {
  if (!isGlobalAdmin(req.user)) {
    return res.status(403).json({ error: 'Only global admins can manage clients' });
  }
  next();
});

router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);

module.exports = router;
