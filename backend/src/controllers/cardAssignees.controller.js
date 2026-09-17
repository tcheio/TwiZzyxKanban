const db = require('../db/connection');
const { PUBLISHED_COLUMN_NAME, isPublishedColumn, statusLabelFor, withKey, fetchCardWithTags } = require('../utils/card-status');

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

  const assignee = db.prepare('SELECT 1 FROM card_assignees WHERE card_id = ? AND user_id = ?').get(card.id, userId);
  if (!assignee) {
    return res.status(404).json({ error: 'Assignation introuvable' });
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM card_assignees WHERE card_id = ? AND user_id = ?').run(card.id, userId);
    db.prepare(
      `INSERT INTO card_assignment_history (card_id, action, previous_user_id, performed_by_user_id)
       VALUES (?, 'remove', ?, ?)`
    ).run(card.id, userId, req.user.id);
  });
  tx();

  res.status(204).send();
}

// Ajoute une personne en plus du responsable principal ("add"), ou remplace le
// responsable principal ("replace"), en un seul appel transactionnel qui peut aussi
// changer le statut du ticket dans la foulée — le tout tracé dans un même historique.
function upsertAssignment(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const { action, user_id, reason, new_column_id, cancel } = req.body || {};

  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action doit être l'un de : ${VALID_ACTIONS.join(', ')}` });
  }
  if (!user_id) {
    return res.status(400).json({ error: 'user_id requis' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'reason requis' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return res.status(400).json({ error: 'user_id invalide' });
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

  if (action === 'add') {
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
  const previousUserId = action === 'replace' ? card.assigned_user_id : null;

  const tx = db.transaction(() => {
    if (action === 'add') {
      db.prepare('INSERT INTO card_assignees (card_id, user_id) VALUES (?, ?)').run(card.id, user_id);
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
    const newStatus = statusLabelFor(updatedCard);
    const statusChanged = newStatus !== previousStatus;

    db.prepare(
      `INSERT INTO card_assignment_history
         (card_id, action, previous_user_id, new_user_id, reason, previous_status, new_status, performed_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      card.id,
      action,
      previousUserId,
      user_id,
      String(reason).trim(),
      statusChanged ? previousStatus : null,
      statusChanged ? newStatus : null,
      req.user.id
    );
  });
  tx();

  const updated = fetchCardWithTags(card.id);
  res.status(201).json(withKey(updated, req.kanbanCode));
}

module.exports = { listAssignees, getAssignmentHistory, removeAssignee, upsertAssignment };
