const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const { list, getOne, create, update, remove, move, cancel, restore } = require('../controllers/cards.controller');
const commentsRoutes = require('./comments.routes');
const cardLinksRoutes = require('./cardLinks.routes');
const cardImagesRoutes = require('./cardImages.routes');

const router = express.Router();

router.get('/', list);
router.post('/', requireAdmin, create);
router.patch('/:id/move', move);
router.patch('/:id/cancel', cancel);
router.patch('/:id/restore', restore);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', requireAdmin, remove);

router.use('/:id/comments', commentsRoutes);
router.use('/:id/links', cardLinksRoutes);
router.use('/:id/images', cardImagesRoutes);

module.exports = router;
