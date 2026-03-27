const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/activitiesController');

const router = Router();
router.use(authenticate);
router.get('/upcoming', c.getUpcoming);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
