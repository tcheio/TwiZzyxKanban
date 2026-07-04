const express = require('express');
const { list, create, remove } = require('../controllers/cardLinks.controller');

const router = express.Router({ mergeParams: true });

router.get('/', list);
router.post('/', create);
router.delete('/:linkId', remove);

module.exports = router;
