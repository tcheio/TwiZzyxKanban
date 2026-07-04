const express = require('express');
const { list, create, remove } = require('../controllers/cardImages.controller');

const router = express.Router({ mergeParams: true });

router.get('/', list);
router.post('/', create);
router.delete('/:imageId', remove);

module.exports = router;
