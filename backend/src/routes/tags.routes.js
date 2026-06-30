const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { list, create, update, remove } = require('../controllers/tags.controller');

const router = express.Router();

router.get('/', list);
router.post('/', requireAdmin, create);
router.patch('/:id', requireAdmin, update);
router.delete('/:id', requireAdmin, remove);

module.exports = router;
