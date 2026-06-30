const bcrypt = require('bcryptjs');
const db = require('../db/connection');

const VALID_ROLES = ['admin', 'user'];

function list(req, res) {
  const users = db
    .prepare('SELECT id, username, role, created_at FROM users ORDER BY username')
    .all();
  res.json(users);
}

function liteList(req, res) {
  const users = db.prepare('SELECT id, username FROM users ORDER BY username').all();
  res.json(users);
}

function create(req, res) {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password et role requis' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role doit être l'un de: ${VALID_ROLES.join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, passwordHash, role);

  const user = db
    .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(user);
}

function update(req, res) {
  const id = Number(req.params.id);
  const { username, password, role } = req.body || {};

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role doit être l'un de: ${VALID_ROLES.join(', ')}` });
  }
  if (role === 'user' && user.role === 'admin') {
    const adminCount = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .get().count;
    if (adminCount <= 1) {
      return res.status(409).json({ error: 'Impossible de rétrograder le dernier administrateur' });
    }
  }

  const nextUsername = username || user.username;
  const nextRole = role || user.role;
  const nextPasswordHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?').run(
    nextUsername,
    nextRole,
    nextPasswordHash,
    id
  );

  const updated = db
    .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
    .get(id);
  res.json(updated);
}

function remove(req, res) {
  const id = Number(req.params.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }
  if (id === req.user.id) {
    return res.status(409).json({ error: 'Impossible de supprimer son propre compte' });
  }
  if (user.role === 'admin') {
    const adminCount = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .get().count;
    if (adminCount <= 1) {
      return res.status(409).json({ error: 'Impossible de supprimer le dernier administrateur' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).send();
}

module.exports = { list, liteList, create, update, remove };
