const express = require('express');
const { list, getOne, create, update, remove, move } = require('../controllers/cards.controller');
const commentsRoutes = require('./comments.routes');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.patch('/:id/move', move);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);

router.use('/:id/comments', commentsRoutes);

module.exports = router;
