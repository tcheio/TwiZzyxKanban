const express = require('express');
const requireKanbanModerator = require('../middleware/requireKanbanModerator');
const { list, create, update, remove } = require('../controllers/tags.controller');

const router = express.Router({ mergeParams: true });

router.get('/', list);
router.post('/', requireKanbanModerator, create);
router.patch('/:id', requireKanbanModerator, update);
router.delete('/:id', requireKanbanModerator, remove);

module.exports = router;
