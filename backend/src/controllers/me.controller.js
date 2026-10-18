const db = require('../db/connection');

// Tickets dont l'utilisateur courant est responsable (principal ou additionnel), tous
// kanbans confondus, en excluant les tickets annulés ou déjà publiés (travail terminé) —
// pensé pour un widget "Mes tickets" sur la page d'accueil, focalisé sur ce qui reste à
// faire. Triés par échéance croissante (sans échéance en dernier), puis par date de
// création. Toujours visible pour son propre responsable même dans une colonne
// restreinte (cf utils/kanban-access.js::canViewCard, même principe).
function myTickets(req, res) {
  const rows = db
    .prepare(
      `WITH involved AS (
         SELECT id AS card_id FROM cards WHERE assigned_user_id = @userId
         UNION
         SELECT card_id FROM card_assignees WHERE user_id = @userId
       )
       SELECT
         cards.id, cards.title, cards.priority, cards.due_date, cards.created_at,
         kanbans.code AS kanban_code, kanbans.name AS kanban_name,
         columns.name AS column_name
       FROM cards
       JOIN involved ON involved.card_id = cards.id
       JOIN kanbans ON kanbans.id = cards.kanban_id
       JOIN columns ON columns.id = cards.column_id
       WHERE cards.cancelled_at IS NULL AND cards.published_at IS NULL
       ORDER BY (cards.due_date IS NULL), cards.due_date ASC, cards.created_at ASC`
    )
    .all({ userId: req.user.id });

  res.json(rows.map((row) => ({ ...row, key: `${row.kanban_code}-${row.id}` })));
}

module.exports = { myTickets };
