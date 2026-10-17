const db = require('../db/connection');
const { ALLOWED_COLORS } = require('../constants/colors');
const { listEmoteFiles } = require('./emotes.controller');

function isAllowedEmote(emoteUrl) {
  return listEmoteFiles().some((e) => e.path === emoteUrl);
}

function list(req, res) {
  const tags = db.prepare('SELECT * FROM tags WHERE kanban_id = ? ORDER BY name').all(req.kanbanId);
  res.json(tags.map((t) => ({ ...t, visible_in_filter: !!t.visible_in_filter })));
}

function create(req, res) {
  const { name, color, emote_url, visible_in_filter } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (color && !ALLOWED_COLORS.includes(color)) {
    return res.status(400).json({ error: `color doit être l'une de: ${ALLOWED_COLORS.join(', ')}` });
  }
  if (emote_url && !isAllowedEmote(emote_url)) {
    return res.status(400).json({ error: 'emote_url invalide' });
  }
  if (visible_in_filter !== undefined && typeof visible_in_filter !== 'boolean') {
    return res.status(400).json({ error: 'visible_in_filter doit être un booléen' });
  }

  const result = db
    .prepare('INSERT INTO tags (kanban_id, name, color, emote_url, visible_in_filter) VALUES (?, ?, ?, ?, ?)')
    .run(req.kanbanId, name.trim(), color || 'gray', emote_url || null, visible_in_filter === false ? 0 : 1);
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...tag, visible_in_filter: !!tag.visible_in_filter });
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name, color, emote_url, visible_in_filter } = req.body || {};

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
  if (visible_in_filter !== undefined && typeof visible_in_filter !== 'boolean') {
    return res.status(400).json({ error: 'visible_in_filter doit être un booléen' });
  }

  db.prepare('UPDATE tags SET name = ?, color = ?, emote_url = ?, visible_in_filter = ? WHERE id = ?').run(
    name ? name.trim() : tag.name,
    color || tag.color,
    emote_url !== undefined ? emote_url || null : tag.emote_url,
    visible_in_filter !== undefined ? (visible_in_filter ? 1 : 0) : tag.visible_in_filter,
    id
  );
  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  res.json({ ...updated, visible_in_filter: !!updated.visible_in_filter });
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
