const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./connection');

const DEFAULT_COLUMNS = ['Idée', 'Préparation/Écriture', 'Tournage', 'Montage', 'Miniature', 'Publié'];
const DEFAULT_TAGS = ['Minecraft', 'Pokémon', 'Ykw Watch', 'Inazuma Eleven'];
const silent = process.env.NODE_ENV === 'test';

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  const cardColumns = db.prepare('PRAGMA table_info(cards)').all();
  if (!cardColumns.some((col) => col.name === 'description')) {
    db.exec('ALTER TABLE cards ADD COLUMN description TEXT');
  }
  if (!cardColumns.some((col) => col.name === 'tag_id')) {
    db.exec('ALTER TABLE cards ADD COLUMN tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL');
  }
  if (!cardColumns.some((col) => col.name === 'due_date')) {
    db.exec('ALTER TABLE cards ADD COLUMN due_date TEXT');
  }
  if (!cardColumns.some((col) => col.name === 'published_at')) {
    db.exec('ALTER TABLE cards ADD COLUMN published_at TEXT');
  }

  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some((col) => col.name === 'avatar_url')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  }

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
      username,
      passwordHash,
      'admin'
    );
    if (!silent) {
      console.log(`Admin par défaut créé (username: ${username}, password: ${password}) — pensez à changer ce mot de passe.`);
    }
  }

  const columnCount = db.prepare('SELECT COUNT(*) AS count FROM columns').get().count;
  if (columnCount === 0) {
    const insertColumn = db.prepare('INSERT INTO columns (name, position) VALUES (?, ?)');
    DEFAULT_COLUMNS.forEach((name, index) => insertColumn.run(name, index));
    if (!silent) {
      console.log('Colonnes par défaut créées.');
    }
  }

  const tagCount = db.prepare('SELECT COUNT(*) AS count FROM tags').get().count;
  if (tagCount === 0) {
    const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
    DEFAULT_TAGS.forEach((name) => insertTag.run(name));
    if (!silent) {
      console.log('Tags par défaut créés.');
    }
  }

  if (!silent) {
    console.log('DB initialisée.');
  }
}

module.exports = migrate;
