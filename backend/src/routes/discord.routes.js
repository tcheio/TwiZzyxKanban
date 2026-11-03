const express = require('express');
const { getSettings, setWebhook, setMember, sendTest } = require('../controllers/discord.controller');

// Monté sous /api/kanbans/:kanbanId/discord, derrière requireKanbanModerator.
const router = express.Router({ mergeParams: true });

router.get('/', getSettings);
router.put('/webhook', setWebhook);
router.patch('/members/:userId', setMember);
router.post('/test', sendTest);

module.exports = router;
