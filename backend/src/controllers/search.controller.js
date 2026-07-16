const db = require('../db/connection');

const MAX_RESULTS = 20;

function searchTickets(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json([]);
  }

  const like = `%${q}%`;
  const baseQuery = `
    SELECT cards.id, cards.title, cards.cancelled_at,
           kanbans.code AS kanban_code, kanbans.name AS kanban_name,
           columns.name AS column_name
    FROM cards
    JOIN kanbans ON kanbans.id = cards.kanban_id
    JOIN columns ON columns.id = cards.column_id
  `;

  const rows =
    req.user.role === 'admin'
      ? db
          .prepare(`${baseQuery} WHERE cards.title LIKE ? ORDER BY cards.updated_at DESC LIMIT ?`)
          .all(like, MAX_RESULTS)
      : db
          .prepare(
            `${baseQuery}
             JOIN kanban_members ON kanban_members.kanban_id = kanbans.id AND kanban_members.user_id = ?
             WHERE cards.title LIKE ?
             ORDER BY cards.updated_at DESC
             LIMIT ?`
          )
          .all(req.user.id, like, MAX_RESULTS);

  res.json(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      key: `${row.kanban_code}-${row.id}`,
      kanban_code: row.kanban_code,
      kanban_name: row.kanban_name,
      column_name: row.column_name,
      cancelled: !!row.cancelled_at,
    }))
  );
}

module.exports = { searchTickets };
