const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./connection');

const DEFAULT_COLUMNS = ['💡Idées', '📝Préparation/Écriture', '🎥Tournage', '🎬Montage', '🖼️Miniature', '✅Publié'];
const DEFAULT_TAGS = ['Minecraft', 'Pokémon', 'Ykw Watch', 'Inazuma Eleven'];
const DEFAULT_EPICS = [
  { name: 'TwiZzyx', color: 'red' },
  { name: 'TwiZzyxPasSympa', color: 'orange' },
  { name: 'Twitch', color: 'violet' },
];
const silent = process.env.NODE_ENV === 'test';

// Renomme les colonnes par défaut d'une base déjà existante vers les nouveaux noms
// (avec émoji). N'affecte pas une colonne que l'utilisateur a lui-même renommée,
// puisque la comparaison se fait sur l'ancien nom exact.
const LEGACY_COLUMN_RENAMES = {
  Idée: '💡Idées',
  'Préparation/Écriture': '📝Préparation/Écriture',
  Tournage: '🎥Tournage',
  Montage: '🎬Montage',
  Miniature: '🖼️Miniature',
  Publié: '✅Publié',
};

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
  if (!cardColumns.some((col) => col.name === 'epic_id')) {
    db.exec('ALTER TABLE cards ADD COLUMN epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL');
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
  } else {
    const renameColumn = db.prepare('UPDATE columns SET name = ? WHERE name = ?');
    Object.entries(LEGACY_COLUMN_RENAMES).forEach(([oldName, newName]) => renameColumn.run(newName, oldName));
  }

  const tagCount = db.prepare('SELECT COUNT(*) AS count FROM tags').get().count;
  if (tagCount === 0) {
    const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
    DEFAULT_TAGS.forEach((name) => insertTag.run(name));
    if (!silent) {
      console.log('Tags par défaut créés.');
    }
  }

  const epicCount = db.prepare('SELECT COUNT(*) AS count FROM epics').get().count;
  if (epicCount === 0) {
    const insertEpic = db.prepare('INSERT INTO epics (name, color) VALUES (?, ?)');
    DEFAULT_EPICS.forEach(({ name, color }) => insertEpic.run(name, color));
    if (!silent) {
      console.log('Epics par défaut créées.');
    }
  }

  if (!silent) {
    console.log('DB initialisée.');
  }
}

module.exports = migrate;
