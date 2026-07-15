const db = require('../db/connection');

function requireKanbanModerator(req, res, next) {
  const kanbanId = Number(req.params.kanbanId);

  const kanban = db.prepare('SELECT id, code FROM kanbans WHERE id = ?').get(kanbanId);
  if (!kanban) {
    return res.status(404).json({ error: 'Kanban introuvable' });
  }

  if (req.user.role === 'admin') {
    req.kanbanId = kanbanId;
    req.kanbanCode = kanban.code;
    return next();
  }

  const member = db
    .prepare('SELECT is_moderator FROM kanban_members WHERE kanban_id = ? AND user_id = ?')
    .get(kanbanId, req.user.id);
  if (!member?.is_moderator) {
    return res.status(403).json({ error: 'Réservé aux modérateurs de ce kanban' });
  }

  req.kanbanId = kanbanId;
  req.kanbanCode = kanban.code;
  next();
}

module.exports = requireKanbanModerator;
