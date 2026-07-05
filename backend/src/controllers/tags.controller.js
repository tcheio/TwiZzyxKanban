const db = require('../db/connection');

function list(req, res) {
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.json(tags);
}

function create(req, res) {
  const { name } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }

  const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name.trim());
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tag);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name } = req.body || {};

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  if (!tag) {
    return res.status(404).json({ error: 'Tag introuvable' });
  }
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }

  db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name.trim(), id);
  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  if (!tag) {
    return res.status(404).json({ error: 'Tag introuvable' });
  }

  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
