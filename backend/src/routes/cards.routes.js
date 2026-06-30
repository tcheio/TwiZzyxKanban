const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { list, getOne, create, update, remove, move } = require('../controllers/cards.controller');
const commentsRoutes = require('./comments.routes');

const router = express.Router();

router.get('/', list);
router.post('/', requireAdmin, create);
router.patch('/:id/move', move);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', requireAdmin, remove);

router.use('/:id/comments', commentsRoutes);

module.exports = router;
