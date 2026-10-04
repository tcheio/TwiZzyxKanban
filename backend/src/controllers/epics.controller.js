const db = require('../db/connection');
const { ALLOWED_COLORS } = require('../constants/colors');
const { listEmoteFiles } = require('./emotes.controller');

function isAllowedEmote(emoteUrl) {
  return listEmoteFiles().some((e) => e.path === emoteUrl);
}

function list(req, res) {
  const epics = db.prepare('SELECT * FROM epics WHERE kanban_id = ? ORDER BY name').all(req.kanbanId);
  res.json(epics);
}

function create(req, res) {
  const { name, color, emote_url } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (color && !ALLOWED_COLORS.includes(color)) {
    return res.status(400).json({ error: `color doit être l'une de: ${ALLOWED_COLORS.join(', ')}` });
  }
  if (emote_url && !isAllowedEmote(emote_url)) {
    return res.status(400).json({ error: 'emote_url invalide' });
  }

  const result = db
    .prepare('INSERT INTO epics (kanban_id, name, color, emote_url) VALUES (?, ?, ?, ?)')
    .run(req.kanbanId, name.trim(), color || 'gray', emote_url || null);
  const epic = db.prepare('SELECT * FROM epics WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(epic);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name, color, emote_url } = req.body || {};

  const epic = db.prepare('SELECT * FROM epics WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!epic) {
    return res.status(404).json({ error: 'Epic introuvable' });
  }
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (color && !ALLOWED_COLORS.includes(color)) {
    return res.status(400).json({ error: `color doit être l'une de: ${ALLOWED_COLORS.join(', ')}` });
  }
  if (emote_url && !isAllowedEmote(emote_url)) {
    return res.status(400).json({ error: 'emote_url invalide' });
  }

  db.prepare('UPDATE epics SET name = ?, color = ?, emote_url = ? WHERE id = ?').run(
    name ? name.trim() : epic.name,
    color || epic.color,
    emote_url !== undefined ? emote_url || null : epic.emote_url,
    id
  );
  const updated = db.prepare('SELECT * FROM epics WHERE id = ?').get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const epic = db.prepare('SELECT * FROM epics WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!epic) {
    return res.status(404).json({ error: 'Epic introuvable' });
  }

  db.prepare('DELETE FROM epics WHERE id = ?').run(id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
