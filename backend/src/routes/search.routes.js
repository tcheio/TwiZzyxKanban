const express = require('express');
const { searchTickets } = require('../controllers/search.controller');

const router = express.Router();

router.get('/tickets', searchTickets);

module.exports = router;
