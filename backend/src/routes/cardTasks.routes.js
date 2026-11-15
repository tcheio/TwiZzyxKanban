const express = require('express');
const { list, create, update, remove } = require('../controllers/cardTasks.controller');

const router = express.Router({ mergeParams: true });

router.get('/', list);
router.post('/', create);
router.patch('/:taskId', update);
router.delete('/:taskId', remove);

module.exports = router;
