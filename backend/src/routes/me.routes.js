const express = require('express');
const { myTickets } = require('../controllers/me.controller');

const router = express.Router();

router.get('/tickets', myTickets);

module.exports = router;
