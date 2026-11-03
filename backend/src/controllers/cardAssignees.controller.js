const db = require('../db/connection');
const { PUBLISHED_COLUMN_NAME, isPublishedColumn, statusLabelFor, withKey, fetchCardWithRelations } = require('../utils/card-status');
const { notifyWatchersAndTargets } = require('../utils/notify');
const { notifyDiscord } = require('../utils/discord');

const VALID_ACTIONS = ['add', 'replace'];

function getCardOr404(req, res) {
  const cardId = Number(req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(cardId, req.kanbanId);
  if (!card) {
    res.status(404).json({ error: 'Carte introuvable' });
    return null;
  }
  return card;
}

function listAssignees(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const assignees = db
    .prepare(
      `SELECT card_assignees.id, card_assignees.card_id, card_assignees.user_id, card_assignees.created_at,
              users.username AS username, users.avatar_url AS avatar_url
       FROM card_assignees
       JOIN users ON users.id = card_assignees.user_id
       WHERE card_assignees.card_id = ?
       ORDER BY card_assignees.created_at ASC, card_assignees.id ASC`
    )
    .all(card.id);
  res.json(assignees);
}

function getAssignmentHistory(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const history = db
    .prepare(
      `SELECT h.id, h.card_id, h.action, h.reason, h.previous_status, h.new_status, h.created_at,
              h.previous_user_id, prev.username AS previous_username, prev.avatar_url AS previous_avatar_url,
              h.new_user_id, next.username AS new_username, next.avatar_url AS new_avatar_url,
              h.performed_by_user_id, actor.username AS performed_by_username
       FROM card_assignment_history h
       LEFT JOIN users prev ON prev.id = h.previous_user_id
       LEFT JOIN users next ON next.id = h.new_user_id
       LEFT JOIN users actor ON actor.id = h.performed_by_user_id
       WHERE h.card_id = ?
       ORDER BY h.created_at DESC, h.id DESC`
    )
    .all(card.id);
  res.json(history);
}

function removeAssignee(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;
  const userId = Number(req.params.userId);
  const { reason } = req.body || {};

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'reason requis' });
  }

  const assignee = db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(card.id, userId);
  if (!assignee) {
    return res.status(404).json({ error: 'Assignation introuvable' });
  }

  const trimmedReason = String(reason).trim();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM card_assignees WHERE card_id = ? AND user_id = ?').run(card.id, userId);
    db.prepare(
      `INSERT INTO card_assignment_history (card_id, action, previous_user_id, reason, performed_by_user_id)
       VALUES (?, 'remove', ?, ?, ?)`
    ).run(card.id, userId, trimmedReason, req.user.id);
  });
  tx();

  const removedUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
  notifyWatchersAndTargets(card.id, {
    kanbanId: req.kanbanId,
    actorUserId: req.user.id,
    type: 'assignee',
    watcherMessage: `${req.user.username} a retiré ${removedUser?.username ?? '?'} des responsables du ticket « ${card.title} »`,
    targets: [
      {
        userId,
        message: `Vous avez été retiré(e) des responsables du ticket « ${card.title} » — Raison : ${trimmedReason}`,
      },
    ],
  });

  res.status(204).send();
}

// Ajoute une personne en plus du responsable principal ("add"), ou remplace un
// responsable existant ("replace") — le principal par défaut, ou un additionnel via
// `replaced_user_id` — en un seul appel transactionnel qui peut aussi changer le statut
// du ticket dans la foulée, le tout tracé dans un même historique.
// Seul un vrai remplacement (quelqu'un perd sa place) exige une raison : un ajout, ou la
// désignation d'un premier responsable sur un ticket non assigné, n'en demande pas.
function upsertAssignment(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const { action, user_id, reason, new_column_id, cancel, replaced_user_id } = req.body || {};

  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action doit être l'un de : ${VALID_ACTIONS.join(', ')}` });
  }
  if (!user_id) {
    return res.status(400).json({ error: 'user_id requis' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return res.status(400).json({ error: 'user_id invalide' });
  }

  // Remplacement d'un responsable additionnel (et non du principal).
  const replacesCoAssignee =
    action === 'replace' &&
    replaced_user_id !== undefined &&
    replaced_user_id !== null &&
    Number(replaced_user_id) !== card.assigned_user_id;
  if (replacesCoAssignee) {
    const isCoAssignee = db
      .prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?')
      .get(card.id, replaced_user_id);
    if (!isCoAssignee) {
      return res.status(400).json({ error: 'replaced_user_id ne fait pas partie des responsables de ce ticket' });
    }
  }

  const previousUserId =
    action !== 'replace' ? null : replacesCoAssignee ? Number(replaced_user_id) : card.assigned_user_id;
  const trimmedReason = reason ? String(reason).trim() : '';
  if (previousUserId && !trimmedReason) {
    return res.status(400).json({ error: 'reason requis pour remplacer un responsable' });
  }

  const wantsStatusChange = new_column_id !== undefined || cancel === true;
  if (wantsStatusChange && isPublishedColumn(card.column_id)) {
    return res.status(400).json({ error: 'Un ticket publié ne peut plus changer de statut' });
  }

  let targetColumn = null;
  if (new_column_id !== undefined) {
    targetColumn = db
      .prepare('SELECT id, name FROM columns WHERE id = ? AND kanban_id = ?')
      .get(new_column_id, req.kanbanId);
    if (!targetColumn) {
      return res.status(400).json({ error: 'new_column_id invalide' });
    }
  }

  if (action === 'add' || replacesCoAssignee) {
    const alreadyPrimary = card.assigned_user_id === Number(user_id);
    const alreadyCoAssignee = db
      .prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?')
      .get(card.id, user_id);
    if (alreadyPrimary || alreadyCoAssignee) {
      return res.status(400).json({ error: 'Cette personne est déjà assignée à ce ticket' });
    }
  } else if (card.assigned_user_id === Number(user_id)) {
    return res.status(400).json({ error: 'Cette personne est déjà responsable de ce ticket' });
  }

  const previousStatus = statusLabelFor(card);
  let statusChanged = false;
  let newStatus = previousStatus;

  const tx = db.transaction(() => {
    if (action === 'add') {
      db.prepare('INSERT INTO card_assignees (card_id, user_id) VALUES (?, ?)').run(card.id, user_id);
    } else if (replacesCoAssignee) {
      db.prepare('UPDATE card_assignees SET user_id = ? WHERE card_id = ? AND user_id = ?').run(
        user_id,
        card.id,
        previousUserId
      );
    } else {
      // La personne qui devient responsable principal ne doit pas rester listée comme
      // responsable additionnel par ailleurs.
      db.prepare('DELETE FROM card_assignees WHERE card_id = ? AND user_id = ?').run(card.id, user_id);
      db.prepare('UPDATE cards SET assigned_user_id = ? WHERE id = ?').run(user_id, card.id);
    }

    if (cancel === true) {
      db.prepare("UPDATE cards SET cancelled_at = datetime('now') WHERE id = ?").run(card.id);
    } else if (targetColumn) {
      if (card.cancelled_at) {
        db.prepare('UPDATE cards SET cancelled_at = NULL WHERE id = ?').run(card.id);
      }
      if (targetColumn.id !== card.column_id) {
        const countInTarget = db
          .prepare('SELECT COUNT(*) AS count FROM cards WHERE column_id = ?')
          .get(targetColumn.id).count;
        db.prepare('UPDATE cards SET column_id = ?, position = ? WHERE id = ?').run(
          targetColumn.id,
          countInTarget,
          card.id
        );
        if (targetColumn.name === PUBLISHED_COLUMN_NAME) {
          db.prepare("UPDATE cards SET published_at = datetime('now') WHERE id = ?").run(card.id);
        }
      }
    }
    db.prepare("UPDATE cards SET updated_at = datetime('now') WHERE id = ?").run(card.id);

    const updatedCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id);
    newStatus = statusLabelFor(updatedCard);
    statusChanged = newStatus !== previousStatus;

    db.prepare(
      `INSERT INTO card_assignment_history
         (card_id, action, previous_user_id, new_user_id, reason, previous_status, new_status, performed_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      card.id,
      action,
      previousUserId,
      user_id,
      trimmedReason || null,
      statusChanged ? previousStatus : null,
      statusChanged ? newStatus : null,
      req.user.id
    );
  });
  tx();

  const targets = [];
  if (action === 'add' || replacesCoAssignee) {
    targets.push({ userId: user_id, message: `Vous avez été ajouté(e) comme responsable du ticket « ${card.title} »` });
  } else {
    targets.push({
      userId: user_id,
      message: `Vous êtes désormais responsable principal du ticket « ${card.title} »`,
    });
  }
  if (previousUserId && previousUserId !== Number(user_id)) {
    targets.push({
      userId: previousUserId,
      message: `Vous n'êtes plus responsable du ticket « ${card.title} » — Raison : ${trimmedReason}`,
    });
  }
  let watcherMessage;
  if (action === 'add') {
    watcherMessage = `${req.user.username} a ajouté ${user.username} comme responsable du ticket « ${card.title} »`;
  } else if (replacesCoAssignee) {
    const replacedUser = db.prepare('SELECT username FROM users WHERE id = ?').get(previousUserId);
    watcherMessage = `${req.user.username} a remplacé ${replacedUser?.username ?? '?'} par ${user.username} parmi les responsables du ticket « ${card.title} »`;
  } else {
    watcherMessage = `${req.user.username} a désigné ${user.username} responsable principal du ticket « ${card.title} »`;
  }
  notifyWatchersAndTargets(card.id, {
    kanbanId: req.kanbanId,
    actorUserId: req.user.id,
    type: 'assignee',
    watcherMessage,
    targets,
  });
  if (statusChanged) {
    notifyWatchersAndTargets(card.id, {
      kanbanId: req.kanbanId,
      actorUserId: req.user.id,
      type: 'status',
      watcherMessage: `Le ticket « ${card.title} » est passé de « ${previousStatus} » à « ${newStatus} »`,
    });
  }

  // Discord : un seul message par événement, qui reprend l'éventuel changement de statut.
  // La personne remplacée le reçoit aussi (elle n'est plus responsable, mais doit savoir).
  let discordMessage;
  if (action === 'add') {
    discordMessage = `👤 ${req.user.username} a ajouté ${user.username} comme responsable`;
  } else if (replacesCoAssignee) {
    const replacedUser = db.prepare('SELECT username FROM users WHERE id = ?').get(previousUserId);
    discordMessage = `🔁 ${req.user.username} a remplacé ${replacedUser?.username ?? '?'} par ${user.username} parmi les responsables`;
  } else if (previousUserId) {
    const replacedUser = db.prepare('SELECT username FROM users WHERE id = ?').get(previousUserId);
    discordMessage = `🔁 ${req.user.username} a désigné ${user.username} responsable principal à la place de ${replacedUser?.username ?? '?'}`;
  } else {
    discordMessage = `👤 ${req.user.username} a désigné ${user.username} responsable principal`;
  }
  if (trimmedReason) discordMessage += `\nRaison : ${trimmedReason}`;
  if (statusChanged) discordMessage += `\n🔄 Statut : « ${previousStatus} » → « ${newStatus} »`;
  notifyDiscord(card.id, {
    kanbanId: req.kanbanId,
    actorUserId: req.user.id,
    message: discordMessage,
    // Un responsable additionnel n'est mentionné qu'au moment où le ticket lui est
    // assigné (ajout, ou remplacement d'un autre additionnel) ; le nouveau principal
    // l'est déjà en tant que principal.
    extraMentionUserIds: action === 'add' || replacesCoAssignee ? [Number(user_id)] : [],
    extraUserIds: previousUserId ? [previousUserId] : [],
  });

  const updated = fetchCardWithRelations(card.id);
  res.status(201).json(withKey(updated, req.kanbanCode));
}

module.exports = { listAssignees, getAssignmentHistory, removeAssignee, upsertAssignment };
