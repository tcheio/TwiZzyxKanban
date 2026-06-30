const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./connection');

const DEFAULT_COLUMNS = ['Idée', 'Script', 'Tournage', 'Montage', 'Publié'];
const silent = process.env.NODE_ENV === 'test';

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

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

  if (!silent) {
    console.log('DB initialisée.');
  }
}

module.exports = migrate;
