const express = require('express');
const { list, create, update, remove } = require('../controllers/tags.controller');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
