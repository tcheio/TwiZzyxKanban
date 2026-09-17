const db = require('../db/connection');
const { ALLOWED_COLORS } = require('../constants/colors');
const { listEmoteFiles } = require('./emotes.controller');

function isAllowedEmote(emoteUrl) {
  return listEmoteFiles().some((e) => e.path === emoteUrl);
}

function list(req, res) {
  const tags = db.prepare('SELECT * FROM tags WHERE kanban_id = ? ORDER BY name').all(req.kanbanId);
  res.json(tags);
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
    .prepare('INSERT INTO tags (kanban_id, name, color, emote_url) VALUES (?, ?, ?, ?)')
    .run(req.kanbanId, name.trim(), color || 'gray', emote_url || null);
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tag);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name, color, emote_url } = req.body || {};

  const tag = db.prepare('SELECT * FROM tags WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!tag) {
    return res.status(404).json({ error: 'Tag introuvable' });
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

  db.prepare('UPDATE tags SET name = ?, color = ?, emote_url = ? WHERE id = ?').run(
    name ? name.trim() : tag.name,
    color || tag.color,
    emote_url !== undefined ? emote_url || null : tag.emote_url,
    id
  );
  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const tag = db.prepare('SELECT * FROM tags WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!tag) {
    return res.status(404).json({ error: 'Tag introuvable' });
  }

  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  res.status(204).send();
}

module.exports = { list, create, update, remove };
