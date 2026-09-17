const db = require('../db/connection');

// Les responsables (principal + additionnels) courants d'un ticket : ce sont eux qui
// reçoivent les notifications concernant "leurs" tickets.
function getCardWatchers(cardId) {
  const card = db.prepare('SELECT assigned_user_id FROM cards WHERE id = ?').get(cardId);
  if (!card) return [];
  const extra = db.prepare('SELECT user_id FROM card_assignees WHERE card_id = ?').all(cardId).map((r) => r.user_id);
  const ids = new Set(extra);
  if (card.assigned_user_id) ids.add(card.assigned_user_id);
  return [...ids];
}

// Insère une notification pour chaque destinataire, sans jamais notifier l'auteur de
// l'action lui-même, et sans doublon si la même personne apparaît dans plusieurs listes.
function notify(userIds, { kanbanId, cardId, actorUserId, type, message }) {
  const insert = db.prepare(
    `INSERT INTO notifications (user_id, kanban_id, card_id, actor_user_id, type, message) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const unique = [...new Set(userIds)].filter((id) => id && id !== actorUserId);
  unique.forEach((userId) => insert.run(userId, kanbanId, cardId, actorUserId || null, type, message));
}

// Notifie tous les responsables courants d'un ticket (hors acteur), avec en plus des
// destinataires ciblés portant chacun leur propre message (ex : la personne qu'on vient
// de retirer, qui a besoin de connaître la raison alors qu'elle n'est plus responsable).
function notifyWatchersAndTargets(cardId, { kanbanId, actorUserId, type, watcherMessage, targets = [] }) {
  // Une personne qui a un message ciblé (ex: "vous avez été ajouté(e)...") ne doit pas
  // recevoir en plus le message générique destiné aux autres responsables pour le même
  // événement — sinon elle se retrouve avec deux notifications qui se recoupent.
  const targetedUserIds = new Set(targets.map((t) => t.userId));
  if (watcherMessage) {
    const watchers = getCardWatchers(cardId).filter((id) => !targetedUserIds.has(id));
    notify(watchers, { kanbanId, cardId, actorUserId, type, message: watcherMessage });
  }
  targets.forEach(({ userId, message }) => {
    notify([userId], { kanbanId, cardId, actorUserId, type, message });
  });
}

module.exports = { getCardWatchers, notify, notifyWatchersAndTargets };
