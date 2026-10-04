const express = require('express');
const { list, markRead, markAllRead } = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/', list);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
