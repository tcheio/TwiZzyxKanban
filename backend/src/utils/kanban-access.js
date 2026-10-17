const db = require('../db/connection');

function isKanbanModerator(kanbanId, user) {
  if (user.role === 'admin') return true;
  const member = db
    .prepare('SELECT is_moderator FROM kanban_members WHERE kanban_id = ? AND user_id = ?')
    .get(kanbanId, user.id);
  return !!member?.is_moderator;
}

// Responsable principal ou additionnel de la carte.
function isAssignedToCard(card, userId) {
  if (card.assigned_user_id === userId) return true;
  const assignee = db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(card.id, userId);
  return !!assignee;
}

// Une carte d'une colonne restreinte n'est visible que des modérateurs du kanban et des
// personnes assignées à cette carte (responsable principal ou additionnel).
function canViewCard(card, kanbanId, user) {
  if (isKanbanModerator(kanbanId, user)) return true;

  const column = db.prepare('SELECT restricted FROM columns WHERE id = ?').get(card.column_id);
  if (!column?.restricted) return true;

  return isAssignedToCard(card, user.id);
}

// Changer le statut d'un ticket (déplacement de colonne, annulation/restauration) est
// réservé aux modérateurs du kanban et aux personnes actuellement en charge du ticket.
function canChangeCardStatus(card, kanbanId, user) {
  return isKanbanModerator(kanbanId, user) || isAssignedToCard(card, user.id);
}

module.exports = { isKanbanModerator, isAssignedToCard, canViewCard, canChangeCardStatus };
