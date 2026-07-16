const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const requireKanbanAccess = require('../middleware/requireKanbanAccess');
const requireKanbanModerator = require('../middleware/requireKanbanModerator');
const {
  list,
  create,
  rename,
  remove,
  membersList,
  membersLite,
  membersAdd,
  membersRemove,
  membersSetModerator,
} = require('../controllers/kanbans.controller');
const columnsRoutes = require('./columns.routes');
const tagsRoutes = require('./tags.routes');
const epicsRoutes = require('./epics.routes');
const cardsRoutes = require('./cards.routes');

const router = express.Router();

router.get('/', list);
router.post('/', requireAdmin, create);
router.patch('/:kanbanId', requireAdmin, rename);
router.delete('/:kanbanId', requireAdmin, remove);

router.get('/:kanbanId/members', requireKanbanAccess, membersList);
router.get('/:kanbanId/members/lite', requireKanbanAccess, membersLite);
router.post('/:kanbanId/members', requireKanbanModerator, membersAdd);
router.delete('/:kanbanId/members/:userId', requireKanbanModerator, membersRemove);
router.patch('/:kanbanId/members/:userId', requireAdmin, membersSetModerator);

router.use('/:kanbanId/columns', requireKanbanAccess, columnsRoutes);
router.use('/:kanbanId/tags', requireKanbanAccess, tagsRoutes);
router.use('/:kanbanId/epics', requireKanbanAccess, epicsRoutes);
router.use('/:kanbanId/cards', requireKanbanAccess, cardsRoutes);

module.exports = router;
