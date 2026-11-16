const db = require('../db/connection');
const { getCardWatchers } = require('./notify');

// Une tâche ne peut être assignée qu'à une personne reliée au ticket (responsable
// principal ou additionnel). Ces deux helpers maintiennent cette règle quand les
// responsables du ticket changent.

// Remplacement d'un responsable : ses tâches passent à la personne qui prend sa place.
function transferTaskAssignments(cardId, fromUserId, toUserId) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;
  db.prepare('UPDATE card_tasks SET assigned_user_id = ? WHERE card_id = ? AND assigned_user_id = ?').run(
    toUserId,
    cardId,
    fromUserId
  );
}

// Désassigne les tâches dont la personne n'est plus reliée au ticket (ex: retrait d'un
// responsable additionnel, responsable principal vidé).
function releaseOrphanTaskAssignments(cardId) {
  const watchers = getCardWatchers(cardId);
  const placeholders = watchers.map(() => '?').join(',');
  const notIn = watchers.length ? `AND assigned_user_id NOT IN (${placeholders})` : '';
  db.prepare(
    `UPDATE card_tasks SET assigned_user_id = NULL WHERE card_id = ? AND assigned_user_id IS NOT NULL ${notIn}`
  ).run(cardId, ...watchers);
}

module.exports = { transferTaskAssignments, releaseOrphanTaskAssignments };
