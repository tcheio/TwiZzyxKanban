const express = require('express');
const { list, create, remove } = require('../controllers/comments.controller');

const router = express.Router({ mergeParams: true });

router.get('/', list);
router.post('/', create);
router.delete('/:commentId', remove);

module.exports = router;
