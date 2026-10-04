// Réinitialise la base locale : sauvegarde l'ancienne base, en recrée une neuve avec un admin
// (admin / admin par défaut) et un kanban "Vidéo" (template video) contenant 2 tickets par colonne.
// Usage : npm run db:reset (serveur backend arrêté, sinon le fichier SQLite est verrouillé).
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');

const rawDbPath = process.env.DB_PATH || './data/kanban.db';
if (rawDbPath === ':memory:') {
  console.error('DB_PATH=:memory: — rien à réinitialiser.');
  process.exit(1);
}
const dbPath = path.resolve(__dirname, '..', rawDbPath);

if (fs.existsSync(dbPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.backup-${stamp}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Ancienne base sauvegardée : ${backupPath}`);
}
try {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
} catch (err) {
  if (err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
  console.error('La base est verrouillée : arrêtez le serveur backend puis relancez npm run db:reset.');
  process.exit(1);
}

process.env.DEFAULT_ADMIN_USERNAME ||= 'admin';
process.env.DEFAULT_ADMIN_PASSWORD = process.env.RESET_ADMIN_PASSWORD || 'admin';

const migrate = require('../src/db/migrate');
const db = require('../src/db/connection');
const { KANBAN_TEMPLATES } = require('../src/db/kanban-templates');

migrate();

const SAMPLE_CARDS = {
  '💡Idées': ['Concept : 100 jours en hardcore', 'Tier list des starters Pokémon'],
  '📝Préparation/Écriture': ['Script : histoire d\'Inazuma Eleven', 'Recherches : les secrets de Ykw Watch'],
  '🎥Tournage': ['Tournage : base automatique Minecraft', 'Session live Pokémon Écarlate'],
  '🎬Montage': ['Montage : best-of du mois', 'Montage : réaction trailer'],
  '🖼️Miniature': ['Miniature : 100 jours hardcore', 'Miniature : tier list starters'],
  '✅Publié': ['Speedrun Minecraft 1.21', 'Top 10 des matchs Inazuma Eleven'],
};

const seed = db.transaction(() => {
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  const kanbanId = db.prepare('INSERT INTO kanbans (name, code) VALUES (?, ?)').run('Kanban Vidéo', 'VIDEO').lastInsertRowid;
  db.prepare('INSERT INTO kanban_members (kanban_id, user_id, is_moderator) VALUES (?, ?, 1)').run(kanbanId, admin.id);

  const template = KANBAN_TEMPLATES.video;
  const insertColumn = db.prepare('INSERT INTO columns (kanban_id, name, position) VALUES (?, ?, ?)');
  const columnIds = template.columns.map((name, index) => insertColumn.run(kanbanId, name, index).lastInsertRowid);

  const insertTag = db.prepare('INSERT INTO tags (kanban_id, name, color) VALUES (?, ?, ?)');
  const tagIds = template.tags.map(({ name, color }) => insertTag.run(kanbanId, name, color).lastInsertRowid);

  const insertCard = db.prepare(
    `INSERT INTO cards (kanban_id, title, tag_id, assigned_user_id, priority, column_id, position, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const priorities = ['low', 'medium', 'high'];
  let cardIndex = 0;
  template.columns.forEach((columnName, columnIndex) => {
    const isPublished = columnName === '✅Publié';
    (SAMPLE_CARDS[columnName] || ['Ticket 1', 'Ticket 2']).forEach((title, position) => {
      insertCard.run(
        kanbanId,
        title,
        tagIds[cardIndex % tagIds.length] ?? null,
        admin.id,
        priorities[cardIndex % priorities.length],
        columnIds[columnIndex],
        position,
        isPublished ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
      );
      cardIndex += 1;
    });
  });
  return cardIndex;
});

const cardCount = seed();
console.log(`Kanban "Kanban Vidéo" (VIDEO) créé avec ${cardCount} tickets.`);
console.log(`Connexion : ${process.env.DEFAULT_ADMIN_USERNAME} / ${process.env.DEFAULT_ADMIN_PASSWORD}`);
