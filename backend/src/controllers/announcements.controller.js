const db = require('../db/connection');

function selectOne(id) {
  return db
    .prepare(
      `SELECT announcements.*, kanbans.name AS kanban_name, kanbans.code AS kanban_code
       FROM announcements
       LEFT JOIN kanbans ON kanbans.id = announcements.kanban_id
       WHERE announcements.id = ?`
    )
    .get(id);
}

// Un admin voit toutes les annonces (pour la page de gestion) ; un utilisateur normal ne
// voit que celles qui le concernent (globales, ou celles du/des kanban(s) dont il est
// membre) — c'est la même liste qui sert au bandeau et à la page d'administration.
function list(req, res) {
  const rows =
    req.user.role === 'admin'
      ? db
          .prepare(
            `SELECT announcements.*, kanbans.name AS kanban_name, kanbans.code AS kanban_code
             FROM announcements
             LEFT JOIN kanbans ON kanbans.id = announcements.kanban_id
             ORDER BY announcements.created_at DESC`
          )
          .all()
      : db
          .prepare(
            `SELECT announcements.*, kanbans.name AS kanban_name, kanbans.code AS kanban_code
             FROM announcements
             LEFT JOIN kanbans ON kanbans.id = announcements.kanban_id
             WHERE announcements.kanban_id IS NULL
                OR announcements.kanban_id IN (SELECT kanban_id FROM kanban_members WHERE user_id = ?)
             ORDER BY announcements.created_at DESC`
          )
          .all(req.user.id);
  res.json(rows);
}

function create(req, res) {
  const { message, kanban_id } = req.body || {};
  if (!message?.trim()) {
    return res.status(400).json({ error: 'message requis' });
  }
  if (kanban_id) {
    const kanban = db.prepare('SELECT id FROM kanbans WHERE id = ?').get(kanban_id);
    if (!kanban) {
      return res.status(400).json({ error: 'kanban_id invalide' });
    }
  }

  const result = db
    .prepare('INSERT INTO announcements (kanban_id, message, created_by_user_id) VALUES (?, ?, ?)')
    .run(kanban_id || null, message.trim(), req.user.id);
  res.status(201).json(selectOne(result.lastInsertRowid));
}

function update(req, res) {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Annonce introuvable' });
  }

  const { message, kanban_id } = req.body || {};
  if (message !== undefined && !message.trim()) {
    return res.status(400).json({ error: 'message requis' });
  }
  if (kanban_id) {
    const kanban = db.prepare('SELECT id FROM kanbans WHERE id = ?').get(kanban_id);
    if (!kanban) {
      return res.status(400).json({ error: 'kanban_id invalide' });
    }
  }

  db.prepare("UPDATE announcements SET message = ?, kanban_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    message !== undefined ? message.trim() : existing.message,
    kanban_id !== undefined ? kanban_id || null : existing.kanban_id,
    id
  );
  res.json(selectOne(id));
}

function remove(req, res) {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Annonce introuvable' });
  }
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
