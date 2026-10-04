const db = require('../db/connection');

function list(req, res) {
  const rows = db
    .prepare(
      `SELECT notifications.*, cards.title AS card_title, kanbans.code AS kanban_code
       FROM notifications
       JOIN cards ON cards.id = notifications.card_id
       JOIN kanbans ON kanbans.id = notifications.kanban_id
       WHERE notifications.user_id = ?
       ORDER BY notifications.created_at DESC, notifications.id DESC
       LIMIT 50`
    )
    .all(req.user.id);
  res.json(rows);
}

function markRead(req, res) {
  const id = Number(req.params.id);
  const notification = db.prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!notification) {
    return res.status(404).json({ error: 'Notification introuvable' });
  }
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ?").run(id);
  res.status(204).send();
}

function markAllRead(req, res) {
  db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.user.id);
  res.status(204).send();
}

module.exports = { list, markRead, markAllRead };
