const express = require('express');
const { getColumnDurations, getUserStats } = require('../controllers/stats.controller');

const router = express.Router({ mergeParams: true });

router.get('/column-durations', getColumnDurations);
router.get('/users', getUserStats);

module.exports = router;
