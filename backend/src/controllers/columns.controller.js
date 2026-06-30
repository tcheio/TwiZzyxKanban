const db = require('../db/connection');

function list(req, res) {
  const columns = db.prepare('SELECT * FROM columns ORDER BY position').all();
  res.json(columns);
}

function create(req, res) {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'name requis' });
  }

  const maxPosition = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM columns')
    .get().maxPos;

  const result = db
    .prepare('INSERT INTO columns (name, position) VALUES (?, ?)')
    .run(name, maxPosition + 1);

  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(column);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name } = req.body || {};

  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(id);
  if (!column) {
    return res.status(404).json({ error: 'Colonne introuvable' });
  }
  if (!name) {
    return res.status(400).json({ error: 'name requis' });
  }

  db.prepare('UPDATE columns SET name = ? WHERE id = ?').run(name, id);
  const updated = db.prepare('SELECT * FROM columns WHERE id = ?').get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(id);
  if (!column) {
    return res.status(404).json({ error: 'Colonne introuvable' });
  }

  const cardCount = db
    .prepare('SELECT COUNT(*) AS count FROM cards WHERE column_id = ?')
    .get(id).count;
  if (cardCount > 0) {
    return res.status(409).json({ error: 'Impossible de supprimer une colonne contenant des cartes' });
  }

  db.prepare('DELETE FROM columns WHERE id = ?').run(id);
  res.status(204).send();
}

function reorder(req, res) {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds (tableau) requis' });
  }

  const update = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
  const reorderTx = db.transaction((ids) => {
    ids.forEach((columnId, index) => update.run(index, columnId));
  });
  reorderTx(orderedIds);

  const columns = db.prepare('SELECT * FROM columns ORDER BY position').all();
  res.json(columns);
}

module.exports = { list, create, update, remove, reorder };
