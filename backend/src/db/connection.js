const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const rawDbPath = process.env.DB_PATH || './data/kanban.db';
const isMemory = rawDbPath === ':memory:';
const dbPath = isMemory ? rawDbPath : path.resolve(__dirname, '../../', rawDbPath);

if (!isMemory) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
if (!isMemory) {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

module.exports = db;
