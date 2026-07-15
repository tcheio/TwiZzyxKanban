const db = require('../db/connection');
const { KANBAN_TEMPLATES, DEFAULT_TEMPLATE, isValidTemplate } = require('../db/kanban-templates');

const CODE_PATTERN = /^[A-Z0-9-]{2,20}$/;

function seedKanbanContent(kanbanId, templateName) {
  const template = KANBAN_TEMPLATES[templateName];

  const insertColumn = db.prepare('INSERT INTO columns (kanban_id, name, position) VALUES (?, ?, ?)');
  template.columns.forEach((name, index) => insertColumn.run(kanbanId, name, index));

  const insertTag = db.prepare('INSERT INTO tags (kanban_id, name) VALUES (?, ?)');
  template.tags.forEach((name) => insertTag.run(kanbanId, name));

  const insertEpic = db.prepare('INSERT INTO epics (kanban_id, name, color) VALUES (?, ?, ?)');
  template.epics.forEach(({ name, color }) => insertEpic.run(kanbanId, name, color));
}

function list(req, res) {
  if (req.user.role === 'admin') {
    const kanbans = db.prepare('SELECT * FROM kanbans ORDER BY name').all();
    return res.json(kanbans.map((k) => ({ ...k, is_moderator: true })));
  }

  const kanbans = db
    .prepare(
      `SELECT kanbans.*, kanban_members.is_moderator AS is_moderator
       FROM kanbans
       JOIN kanban_members ON kanban_members.kanban_id = kanbans.id
       WHERE kanban_members.user_id = ?
       ORDER BY kanbans.name`
    )
    .all(req.user.id);
  res.json(kanbans.map((k) => ({ ...k, is_moderator: !!k.is_moderator })));
}

function create(req, res) {
  const { name, code, template } = req.body || {};
  if (!name?.trim() || !code?.trim()) {
    return res.status(400).json({ error: 'name et code requis' });
  }
  const normalizedCode = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalizedCode)) {
    return res.status(400).json({ error: 'code doit contenir uniquement des lettres, chiffres et tirets (2 à 20 caractères)' });
  }
  const templateName = template || DEFAULT_TEMPLATE;
  if (!isValidTemplate(templateName)) {
    return res.status(400).json({ error: `template doit être l'un de: ${Object.keys(KANBAN_TEMPLATES).join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM kanbans WHERE code = ?').get(normalizedCode);
  if (existing) {
    return res.status(409).json({ error: 'Ce code de kanban existe déjà' });
  }

  const createTx = db.transaction(() => {
    const kanbanId = db
      .prepare('INSERT INTO kanbans (name, code) VALUES (?, ?)')
      .run(name.trim(), normalizedCode).lastInsertRowid;
    seedKanbanContent(kanbanId, templateName);
    return kanbanId;
  });
  const kanbanId = createTx();

  const kanban = db.prepare('SELECT * FROM kanbans WHERE id = ?').get(kanbanId);
  res.status(201).json({ ...kanban, is_moderator: true });
}

function rename(req, res) {
  const kanbanId = Number(req.params.kanbanId);
  const { name } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }

  const kanban = db.prepare('SELECT * FROM kanbans WHERE id = ?').get(kanbanId);
  if (!kanban) {
    return res.status(404).json({ error: 'Kanban introuvable' });
  }

  db.prepare('UPDATE kanbans SET name = ? WHERE id = ?').run(name.trim(), kanbanId);
  const updated = db.prepare('SELECT * FROM kanbans WHERE id = ?').get(kanbanId);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.kanbanId);

  const kanban = db.prepare('SELECT id FROM kanbans WHERE id = ?').get(id);
  if (!kanban) {
    return res.status(404).json({ error: 'Kanban introuvable' });
  }

  db.prepare('DELETE FROM kanbans WHERE id = ?').run(id);
  res.status(204).send();
}

function membersList(req, res) {
  const members = db
    .prepare(
      `SELECT users.id, users.username, users.avatar_url, kanban_members.is_moderator
       FROM kanban_members
       JOIN users ON users.id = kanban_members.user_id
       WHERE kanban_members.kanban_id = ?
       ORDER BY users.username`
    )
    .all(req.kanbanId);
  res.json(members.map((m) => ({ ...m, is_moderator: !!m.is_moderator })));
}

function membersLite(req, res) {
  const members = db
    .prepare(
      `SELECT users.id, users.username, users.avatar_url
       FROM kanban_members
       JOIN users ON users.id = kanban_members.user_id
       WHERE kanban_members.kanban_id = ?
       ORDER BY users.username`
    )
    .all(req.kanbanId);
  res.json(members);
}

function membersAdd(req, res) {
  const kanbanId = req.kanbanId;
  const { user_id: userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'user_id requis' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(400).json({ error: 'user_id invalide' });
  }

  const existing = db.prepare('SELECT 1 FROM kanban_members WHERE kanban_id = ? AND user_id = ?').get(kanbanId, userId);
  if (existing) {
    return res.status(409).json({ error: 'Cet utilisateur est déjà membre de ce kanban' });
  }

  db.prepare('INSERT INTO kanban_members (kanban_id, user_id, is_moderator) VALUES (?, ?, 0)').run(kanbanId, userId);
  const member = db
    .prepare(
      `SELECT users.id, users.username, users.avatar_url, kanban_members.is_moderator
       FROM kanban_members JOIN users ON users.id = kanban_members.user_id
       WHERE kanban_members.kanban_id = ? AND kanban_members.user_id = ?`
    )
    .get(kanbanId, userId);
  res.status(201).json({ ...member, is_moderator: !!member.is_moderator });
}

function membersRemove(req, res) {
  const kanbanId = req.kanbanId;
  const userId = Number(req.params.userId);

  const member = db.prepare('SELECT * FROM kanban_members WHERE kanban_id = ? AND user_id = ?').get(kanbanId, userId);
  if (!member) {
    return res.status(404).json({ error: 'Ce membre est introuvable sur ce kanban' });
  }
  if (member.is_moderator && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Seul un admin peut retirer un modérateur' });
  }

  db.prepare('DELETE FROM kanban_members WHERE kanban_id = ? AND user_id = ?').run(kanbanId, userId);
  res.status(204).send();
}

function membersSetModerator(req, res) {
  const kanbanId = Number(req.params.kanbanId);
  const userId = Number(req.params.userId);
  const { is_moderator: isModerator } = req.body || {};
  if (typeof isModerator !== 'boolean') {
    return res.status(400).json({ error: 'is_moderator (booléen) requis' });
  }

  const member = db.prepare('SELECT * FROM kanban_members WHERE kanban_id = ? AND user_id = ?').get(kanbanId, userId);
  if (!member) {
    return res.status(404).json({ error: 'Ce membre est introuvable sur ce kanban' });
  }

  db.prepare('UPDATE kanban_members SET is_moderator = ? WHERE kanban_id = ? AND user_id = ?').run(
    isModerator ? 1 : 0,
    kanbanId,
    userId
  );
  const updated = db
    .prepare(
      `SELECT users.id, users.username, users.avatar_url, kanban_members.is_moderator
       FROM kanban_members JOIN users ON users.id = kanban_members.user_id
       WHERE kanban_members.kanban_id = ? AND kanban_members.user_id = ?`
    )
    .get(kanbanId, userId);
  res.json({ ...updated, is_moderator: !!updated.is_moderator });
}

module.exports = {
  list,
  create,
  rename,
  remove,
  membersList,
  membersLite,
  membersAdd,
  membersRemove,
  membersSetModerator,
};
