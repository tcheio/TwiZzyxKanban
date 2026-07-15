const express = require('express');
const requireKanbanModerator = require('../middleware/requireKanbanModerator');
const { list, getOne, create, update, remove, move, cancel, restore } = require('../controllers/cards.controller');
const commentsRoutes = require('./comments.routes');
const cardLinksRoutes = require('./cardLinks.routes');
const cardImagesRoutes = require('./cardImages.routes');

const router = express.Router({ mergeParams: true });

router.get('/', list);
router.post('/', requireKanbanModerator, create);
router.patch('/:id/move', move);
router.patch('/:id/cancel', cancel);
router.patch('/:id/restore', restore);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', requireKanbanModerator, remove);

router.use('/:id/comments', commentsRoutes);
router.use('/:id/links', cardLinksRoutes);
router.use('/:id/images', cardImagesRoutes);

module.exports = router;
