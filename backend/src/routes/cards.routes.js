const express = require('express');
const { list, create, update, remove, move } = require('../controllers/cards.controller');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.patch('/:id/move', move);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
