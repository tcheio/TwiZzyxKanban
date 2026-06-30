const express = require('express');
const { list, create, update, remove, reorder } = require('../controllers/columns.controller');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.patch('/reorder', reorder);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
