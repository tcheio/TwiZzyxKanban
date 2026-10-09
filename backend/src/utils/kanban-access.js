const db = require('../db/connection');

function isKanbanModerator(kanbanId, user) {
  if (user.role === 'admin') return true;
  const member = db
    .prepare('SELECT is_moderator FROM kanban_members WHERE kanban_id = ? AND user_id = ?')
    .get(kanbanId, user.id);
  return !!member?.is_moderator;
}

// Une carte d'une colonne restreinte n'est visible que des modérateurs du kanban et des
// personnes assignées à cette carte (responsable principal ou additionnel).
function canViewCard(card, kanbanId, user) {
  if (isKanbanModerator(kanbanId, user)) return true;

  const column = db.prepare('SELECT restricted FROM columns WHERE id = ?').get(card.column_id);
  if (!column?.restricted) return true;

  if (card.assigned_user_id === user.id) return true;
  const assignee = db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(card.id, user.id);
  return !!assignee;
}

module.exports = { isKanbanModerator, canViewCard };
