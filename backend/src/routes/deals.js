const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/dealsController');

const router = Router();
router.use(authenticate);
router.get('/owners', c.getOwners);
router.get('/', c.getAll);
router.get('/pipeline', c.getPipeline);
router.get('/:id', c.getById);
router.post('/', c.create);
router.put('/:id', c.update);
router.patch('/:id/stage', c.updateStage);
router.delete('/:id', c.remove);

module.exports = router;
