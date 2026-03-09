const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const c = require('../controllers/companiesController');

const router = Router();
router.use(authenticate);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', authorize('admin', 'manager'), c.remove);

module.exports = router;
