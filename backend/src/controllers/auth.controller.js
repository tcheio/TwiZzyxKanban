const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const MIN_PASSWORD_LENGTH = 6;

function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username et password requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, avatar_url: user.avatar_url },
  });
}

function me(req, res) {
  const user = db
    .prepare('SELECT id, username, role, avatar_url FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }
  res.json(user);
}

function updateMe(req, res) {
  const { username, password, currentPassword, avatar_url } = req.body || {};

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  if (username && username !== user.username) {
    const existing = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(username, user.id);
    if (existing) {
      return res.status(409).json({ error: "Ce nom d'utilisateur existe déjà" });
    }
  }

  let nextPasswordHash = user.password_hash;
  if (password) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` });
    }
    nextPasswordHash = bcrypt.hashSync(password, 10);
  }

  const nextUsername = username || user.username;
  const nextAvatarUrl = avatar_url !== undefined ? avatar_url : user.avatar_url;

  db.prepare('UPDATE users SET username = ?, password_hash = ?, avatar_url = ? WHERE id = ?').run(
    nextUsername,
    nextPasswordHash,
    nextAvatarUrl,
    user.id
  );

  const updated = db
    .prepare('SELECT id, username, role, avatar_url FROM users WHERE id = ?')
    .get(user.id);
  res.json(updated);
}

module.exports = { login, me, updateMe };
