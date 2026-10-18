const { columnDurations, userStats } = require('../utils/stats');

function getColumnDurations(req, res) {
  const { from, to } = req.query || {};
  res.json(columnDurations(req.kanbanId, from, to));
}

function getUserStats(req, res) {
  const { from, to } = req.query || {};
  res.json(userStats(req.kanbanId, from, to));
}

module.exports = { getColumnDurations, getUserStats };
