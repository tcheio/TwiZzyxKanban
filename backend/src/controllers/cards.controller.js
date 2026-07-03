const db = require('../db/connection');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const PUBLISHED_COLUMN_NAME = '✅Publié';

function isPublishedColumn(columnId) {
  const column = db.prepare('SELECT name FROM columns WHERE id = ?').get(columnId);
  return column?.name === PUBLISHED_COLUMN_NAME;
}

function list(req, res) {
  const cards = db.prepare('SELECT * FROM cards ORDER BY column_id, position').all();
  res.json(cards);
}

function getOne(req, res) {
  const id = Number(req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  res.json(card);
}

function create(req, res) {
  const { title, channel, assigned_user_id, priority, column_id, tag_id, epic_id, due_date } = req.body || {};

  if (!title || !column_id) {
    return res.status(400).json({ error: 'title et column_id requis' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority doit être l'un de: ${VALID_PRIORITIES.join(', ')}` });
  }

  const column = db.prepare('SELECT id FROM columns WHERE id = ?').get(column_id);
  if (!column) {
    return res.status(400).json({ error: 'column_id invalide' });
  }
  if (tag_id) {
    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tag_id);
    if (!tag) {
      return res.status(400).json({ error: 'tag_id invalide' });
    }
  }
  if (epic_id) {
    const epic = db.prepare('SELECT id FROM epics WHERE id = ?').get(epic_id);
    if (!epic) {
      return res.status(400).json({ error: 'epic_id invalide' });
    }
  }

  const maxPosition = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM cards WHERE column_id = ?')
    .get(column_id).maxPos;

  const publishedAt = isPublishedColumn(column_id) ? new Date().toISOString() : null;

  const result = db
    .prepare(
      `INSERT INTO cards (title, channel, assigned_user_id, priority, column_id, tag_id, epic_id, position, due_date, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      channel || null,
      assigned_user_id || null,
      priority || 'medium',
      column_id,
      tag_id || null,
      epic_id || null,
      maxPosition + 1,
      due_date || null,
      publishedAt
    );

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { title, channel, description, assigned_user_id, priority, tag_id, epic_id, due_date } = req.body || {};

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: `priority doit être l'un de: ${VALID_PRIORITIES.join(', ')}` });
  }
  if (tag_id) {
    const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tag_id);
    if (!tag) {
      return res.status(400).json({ error: 'tag_id invalide' });
    }
  }
  if (epic_id) {
    const epic = db.prepare('SELECT id FROM epics WHERE id = ?').get(epic_id);
    if (!epic) {
      return res.status(400).json({ error: 'epic_id invalide' });
    }
  }

  db.prepare(
    `UPDATE cards SET title = ?, channel = ?, description = ?, assigned_user_id = ?, priority = ?, tag_id = ?, epic_id = ?, due_date = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? card.title,
    channel !== undefined ? channel : card.channel,
    description !== undefined ? description : card.description,
    assigned_user_id !== undefined ? assigned_user_id : card.assigned_user_id,
    priority || card.priority,
    tag_id !== undefined ? tag_id : card.tag_id,
    epic_id !== undefined ? epic_id : card.epic_id,
    due_date !== undefined ? due_date : card.due_date,
    id
  );

  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }

  db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  res.status(204).send();
}

function move(req, res) {
  const id = Number(req.params.id);
  const { columnId } = req.body || {};
  let { position } = req.body || {};

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  if (columnId === undefined) {
    return res.status(400).json({ error: 'columnId requis' });
  }

  const targetColumn = db.prepare('SELECT id, name FROM columns WHERE id = ?').get(columnId);
  if (!targetColumn) {
    return res.status(400).json({ error: 'columnId invalide' });
  }

  if (columnId !== card.column_id && isPublishedColumn(card.column_id) && targetColumn.name !== PUBLISHED_COLUMN_NAME) {
    return res.status(400).json({ error: 'Un ticket publié ne peut plus être déplacé vers une autre colonne.' });
  }

  if (position === undefined) {
    // Pas de position explicite (ex: changement de statut hors drag&drop) : on ajoute en fin de colonne cible
    const countInTarget = db
      .prepare('SELECT COUNT(*) AS count FROM cards WHERE column_id = ?')
      .get(columnId).count;
    position = columnId === card.column_id ? Math.max(countInTarget - 1, 0) : countInTarget;
  }

  const moveTx = db.transaction(() => {
    if (card.column_id === columnId) {
      // Déplacement au sein de la même colonne : ne décaler que la plage traversée
      if (position > card.position) {
        db.prepare(
          'UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ? AND position <= ?'
        ).run(columnId, card.position, position);
      } else if (position < card.position) {
        db.prepare(
          'UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND position < ?'
        ).run(columnId, position, card.position);
      }
    } else {
      // Referme l'espace laissé dans la colonne de départ
      db.prepare(
        'UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?'
      ).run(card.column_id, card.position);

      // Ouvre un espace dans la colonne d'arrivée
      db.prepare(
        'UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?'
      ).run(columnId, position);
    }

    if (columnId !== card.column_id && targetColumn.name === PUBLISHED_COLUMN_NAME) {
      db.prepare(
        `UPDATE cards SET column_id = ?, position = ?, published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).run(columnId, position, id);
    } else {
      db.prepare(
        `UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(columnId, position, id);
    }
  });
  moveTx();

  const moved = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  res.json(moved);
}

module.exports = { list, getOne, create, update, remove, move };
