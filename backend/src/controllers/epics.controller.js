const db = require('../db/connection');

const ALLOWED_COLORS = ['red', 'orange', 'amber', 'emerald', 'sky', 'violet', 'rose', 'indigo', 'gray'];

function list(req, res) {
  const epics = db.prepare('SELECT * FROM epics ORDER BY name').all();
  res.json(epics);
}

function create(req, res) {
  const { name, color } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (color && !ALLOWED_COLORS.includes(color)) {
    return res.status(400).json({ error: `color doit être l'une de: ${ALLOWED_COLORS.join(', ')}` });
  }

  const result = db
    .prepare('INSERT INTO epics (name, color) VALUES (?, ?)')
    .run(name.trim(), color || 'gray');
  const epic = db.prepare('SELECT * FROM epics WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(epic);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name, color } = req.body || {};

  const epic = db.prepare('SELECT * FROM epics WHERE id = ?').get(id);
  if (!epic) {
    return res.status(404).json({ error: 'Epic introuvable' });
  }
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (color && !ALLOWED_COLORS.includes(color)) {
    return res.status(400).json({ error: `color doit être l'une de: ${ALLOWED_COLORS.join(', ')}` });
  }

  db.prepare('UPDATE epics SET name = ?, color = ? WHERE id = ?').run(
    name ? name.trim() : epic.name,
    color || epic.color,
    id
  );
  const updated = db.prepare('SELECT * FROM epics WHERE id = ?').get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const epic = db.prepare('SELECT * FROM epics WHERE id = ?').get(id);
  if (!epic) {
    return res.status(404).json({ error: 'Epic introuvable' });
  }

  db.prepare('DELETE FROM epics WHERE id = ?').run(id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
