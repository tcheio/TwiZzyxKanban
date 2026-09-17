const express = require('express');
const { addCardTag, removeCardTag } = require('../controllers/cardTags.controller');

const router = express.Router({ mergeParams: true });

router.post('/', addCardTag);
router.delete('/:tagId', removeCardTag);

module.exports = router;
