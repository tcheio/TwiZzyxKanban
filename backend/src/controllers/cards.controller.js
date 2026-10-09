const db = require('../db/connection');
const { sanitizeRichText } = require('../utils/rich-text');
const {
  PUBLISHED_COLUMN_NAME,
  isPublishedColumn,
  columnStateLabel,
  withKey,
  EXTRA_RELATIONS_SUBQUERY,
  mapCardRelations,
  fetchCardWithRelations,
} = require('../utils/card-status');
const { notifyWatchersAndTargets, notifyModerators } = require('../utils/notify');
const { isKanbanModerator, canViewCard, canChangeCardStatus } = require('../utils/kanban-access');

const VALID_PRIORITIES = ['low', 'medium', 'high'];

// Les cartes d'une colonne restreinte (ex: "💡Idées") n'apparaissent que pour les
// modérateurs du kanban et les personnes assignées à la carte.
function list(req, res) {
  const moderator = isKanbanModerator(req.kanbanId, req.user);
  const cards = db
    .prepare(
      `SELECT cards.*, ${EXTRA_RELATIONS_SUBQUERY}
       FROM cards
       JOIN columns ON columns.id = cards.column_id
       WHERE cards.kanban_id = ?
         AND (
           ? = 1
           OR columns.restricted = 0
           OR cards.assigned_user_id = ?
           OR EXISTS (SELECT 1 FROM card_assignees WHERE card_assignees.card_id = cards.id AND card_assignees.user_id = ?)
         )
       ORDER BY cards.column_id, cards.position`
    )
    .all(req.kanbanId, moderator ? 1 : 0, req.user.id, req.user.id);
  res.json(cards.map((card) => withKey(mapCardRelations(card), req.kanbanCode)));
}

function getOne(req, res) {
  const id = Number(req.params.id);
  const card = fetchCardWithRelations(id);
  if (!card || card.kanban_id !== req.kanbanId || !canViewCard(card, req.kanbanId, req.user)) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  res.json(withKey(card, req.kanbanCode));
}

function create(req, res) {
  const { title, description, assigned_user_id, priority, column_id, tag_id, epic_id, due_date, cloned_from_id } =
    req.body || {};
  let { state } = req.body || {};

  if (!title || !column_id) {
    return res.status(400).json({ error: 'title et column_id requis' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority doit être l'un de: ${VALID_PRIORITIES.join(', ')}` });
  }
  if (state !== undefined && state !== null && !['a', 'b'].includes(state)) {
    return res.status(400).json({ error: "state doit être 'a' ou 'b'" });
  }

  const column = db
    .prepare('SELECT id, state_a_name FROM columns WHERE id = ? AND kanban_id = ?')
    .get(column_id, req.kanbanId);
  if (!column) {
    return res.status(400).json({ error: 'column_id invalide' });
  }
  // L'état n'a de sens que si la colonne est divisée en 2 : on force 'a' par défaut si
  // elle l'est et qu'aucun état n'est fourni, et on ignore toute valeur sinon.
  state = column.state_a_name ? state || 'a' : null;
  if (tag_id) {
    const tag = db.prepare('SELECT id FROM tags WHERE id = ? AND kanban_id = ?').get(tag_id, req.kanbanId);
    if (!tag) {
      return res.status(400).json({ error: 'tag_id invalide' });
    }
  }
  if (epic_id) {
    const epic = db.prepare('SELECT id FROM epics WHERE id = ? AND kanban_id = ?').get(epic_id, req.kanbanId);
    if (!epic) {
      return res.status(400).json({ error: 'epic_id invalide' });
    }
  }
  if (cloned_from_id) {
    const source = db.prepare('SELECT id FROM cards WHERE id = ? AND kanban_id = ?').get(cloned_from_id, req.kanbanId);
    if (!source) {
      return res.status(400).json({ error: 'cloned_from_id invalide' });
    }
  }

  const maxPosition = db
    .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM cards WHERE column_id = ? AND COALESCE(state,'') = COALESCE(?, '')")
    .get(column_id, state).maxPos;

  const publishedAt = isPublishedColumn(column_id) ? new Date().toISOString() : null;

  const result = db
    .prepare(
      `INSERT INTO cards (kanban_id, title, description, assigned_user_id, priority, column_id, tag_id, epic_id, cloned_from_id, position, state, due_date, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.kanbanId,
      title,
      description ? sanitizeRichText(description) : null,
      assigned_user_id || null,
      priority || 'medium',
      column_id,
      tag_id || null,
      epic_id || null,
      cloned_from_id || null,
      maxPosition + 1,
      state,
      due_date || null,
      publishedAt
    );

  const card = fetchCardWithRelations(result.lastInsertRowid);
  res.status(201).json(withKey(card, req.kanbanCode));
}

function update(req, res) {
  const id = Number(req.params.id);
  const { title, description, assigned_user_id, priority, tag_id, epic_id, due_date } = req.body || {};

  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority doit être l'un de: ${VALID_PRIORITIES.join(', ')}` });
  }
  if (tag_id) {
    const tag = db.prepare('SELECT id FROM tags WHERE id = ? AND kanban_id = ?').get(tag_id, req.kanbanId);
    if (!tag) {
      return res.status(400).json({ error: 'tag_id invalide' });
    }
  }
  if (epic_id) {
    const epic = db.prepare('SELECT id FROM epics WHERE id = ? AND kanban_id = ?').get(epic_id, req.kanbanId);
    if (!epic) {
      return res.status(400).json({ error: 'epic_id invalide' });
    }
  }

  db.prepare(
    `UPDATE cards SET title = ?, description = ?, assigned_user_id = ?, priority = ?, tag_id = ?, epic_id = ?, due_date = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? card.title,
    description !== undefined ? (description ? sanitizeRichText(description) : description) : card.description,
    assigned_user_id !== undefined ? assigned_user_id : card.assigned_user_id,
    priority || card.priority,
    tag_id !== undefined ? tag_id : card.tag_id,
    epic_id !== undefined ? epic_id : card.epic_id,
    due_date !== undefined ? due_date : card.due_date,
    id
  );

  if (tag_id !== undefined && tag_id !== card.tag_id) {
    const previousTag = card.tag_id ? db.prepare('SELECT name FROM tags WHERE id = ?').get(card.tag_id) : null;
    const nextTag = tag_id ? db.prepare('SELECT name FROM tags WHERE id = ?').get(tag_id) : null;
    const message = nextTag
      ? `${req.user.username} a mis le tag « ${nextTag.name} » sur le ticket « ${card.title} »`
      : `${req.user.username} a retiré le tag « ${previousTag?.name ?? '?'} » du ticket « ${card.title} »`;
    notifyWatchersAndTargets(id, { kanbanId: req.kanbanId, actorUserId: req.user.id, type: 'tag', watcherMessage: message });
  }

  const updated = fetchCardWithRelations(id);
  res.json(withKey(updated, req.kanbanCode));
}

function remove(req, res) {
  const id = Number(req.params.id);

  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }

  db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  res.status(204).send();
}

function move(req, res) {
  const id = Number(req.params.id);
  const { columnId } = req.body || {};
  let { position, state } = req.body || {};

  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  const moderator = isKanbanModerator(req.kanbanId, req.user);
  if (!moderator && !canChangeCardStatus(card, req.kanbanId, req.user)) {
    return res.status(403).json({ error: 'Réservé aux modérateurs et aux responsables de ce ticket' });
  }
  if (columnId === undefined) {
    return res.status(400).json({ error: 'columnId requis' });
  }
  if (state !== undefined && state !== null && !['a', 'b'].includes(state)) {
    return res.status(400).json({ error: "state doit être 'a' ou 'b'" });
  }

  const targetColumn = db
    .prepare('SELECT id, name, state_a_name, state_b_name FROM columns WHERE id = ? AND kanban_id = ?')
    .get(columnId, req.kanbanId);
  if (!targetColumn) {
    return res.status(400).json({ error: 'columnId invalide' });
  }

  if (columnId !== card.column_id && isPublishedColumn(card.column_id) && targetColumn.name !== PUBLISHED_COLUMN_NAME) {
    return res.status(400).json({ error: 'Un ticket publié ne peut plus être déplacé vers une autre colonne.' });
  }

  // L'état n'a de sens que si la colonne cible est divisée en 2 : on le force à null
  // sinon. S'il n'est pas fourni, on garde l'état courant si on reste dans la même
  // colonne (simple réordonnancement), ou on retombe sur le premier état en arrivant
  // d'ailleurs.
  if (!targetColumn.state_a_name) {
    state = null;
  } else if (state === undefined) {
    state = columnId === card.column_id ? card.state || 'a' : 'a';
  }

  // "Partition" = la liste au sein de laquelle les positions sont contiguës : la colonne
  // seule si elle n'est pas divisée, la colonne + l'état sinon.
  const samePartition = columnId === card.column_id && (card.state ?? null) === (state ?? null);

  if (position === undefined) {
    // Pas de position explicite (ex: changement de statut hors drag&drop) : on ajoute en fin de la liste cible
    const countInTarget = db
      .prepare("SELECT COUNT(*) AS count FROM cards WHERE column_id = ? AND COALESCE(state,'') = COALESCE(?, '')")
      .get(columnId, state).count;
    position = samePartition ? Math.max(countInTarget - 1, 0) : countInTarget;
  }

  const moveTx = db.transaction(() => {
    if (samePartition) {
      // Déplacement au sein de la même liste : ne décaler que la plage traversée
      if (position > card.position) {
        db.prepare(
          "UPDATE cards SET position = position - 1 WHERE column_id = ? AND COALESCE(state,'') = COALESCE(?, '') AND position > ? AND position <= ?"
        ).run(columnId, state, card.position, position);
      } else if (position < card.position) {
        db.prepare(
          "UPDATE cards SET position = position + 1 WHERE column_id = ? AND COALESCE(state,'') = COALESCE(?, '') AND position >= ? AND position < ?"
        ).run(columnId, state, position, card.position);
      }
    } else {
      // Referme l'espace laissé dans la liste de départ
      db.prepare(
        "UPDATE cards SET position = position - 1 WHERE column_id = ? AND COALESCE(state,'') = COALESCE(?, '') AND position > ?"
      ).run(card.column_id, card.state, card.position);

      // Ouvre un espace dans la liste d'arrivée
      db.prepare(
        "UPDATE cards SET position = position + 1 WHERE column_id = ? AND COALESCE(state,'') = COALESCE(?, '') AND position >= ?"
      ).run(columnId, state, position);
    }

    if (columnId !== card.column_id && targetColumn.name === PUBLISHED_COLUMN_NAME) {
      db.prepare(
        `UPDATE cards SET column_id = ?, state = ?, position = ?, published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).run(columnId, state, position, id);
    } else {
      db.prepare(
        `UPDATE cards SET column_id = ?, state = ?, position = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(columnId, state, position, id);
    }
  });
  moveTx();

  if (!samePartition) {
    const previousColumn = db
      .prepare('SELECT name, state_a_name, state_b_name FROM columns WHERE id = ?')
      .get(card.column_id);
    const message = `${req.user.username} a déplacé le ticket « ${card.title} » de « ${columnStateLabel(previousColumn, card.state)} » vers « ${columnStateLabel(targetColumn, state)} »`;
    notifyWatchersAndTargets(id, {
      kanbanId: req.kanbanId,
      actorUserId: req.user.id,
      type: 'status',
      watcherMessage: message,
    });
    if (!moderator) {
      notifyModerators(id, { kanbanId: req.kanbanId, actorUserId: req.user.id, type: 'status', message });
    }
  }

  const moved = fetchCardWithRelations(id);
  res.json(withKey(moved, req.kanbanCode));
}

function setCancelled(req, res, isCancelled) {
  const id = Number(req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  const moderator = isKanbanModerator(req.kanbanId, req.user);
  if (!moderator && !canChangeCardStatus(card, req.kanbanId, req.user)) {
    return res.status(403).json({ error: 'Réservé aux modérateurs et aux responsables de ce ticket' });
  }

  const cancelledAtExpr = isCancelled ? "datetime('now')" : 'NULL';
  db.prepare(`UPDATE cards SET cancelled_at = ${cancelledAtExpr}, updated_at = datetime('now') WHERE id = ?`).run(id);

  const message = isCancelled
    ? `${req.user.username} a annulé le ticket « ${card.title} »`
    : `${req.user.username} a restauré le ticket « ${card.title} »`;
  notifyWatchersAndTargets(id, {
    kanbanId: req.kanbanId,
    actorUserId: req.user.id,
    type: 'status',
    watcherMessage: message,
  });
  if (!moderator) {
    notifyModerators(id, { kanbanId: req.kanbanId, actorUserId: req.user.id, type: 'status', message });
  }

  res.json(withKey(fetchCardWithRelations(id), req.kanbanCode));
}

function cancel(req, res) {
  setCancelled(req, res, true);
}

function restore(req, res) {
  setCancelled(req, res, false);
}

module.exports = { list, getOne, create, update, remove, move, cancel, restore };
