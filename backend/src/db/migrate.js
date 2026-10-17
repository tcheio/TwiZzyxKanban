const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const db = require('./connection');

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

function addMissingCardColumns(cardColumns) {
  const columnsToAdd = [
    ['kanban_id', 'INTEGER REFERENCES kanbans(id) ON DELETE CASCADE'],
    ['description', 'TEXT'],
    ['tag_id', 'INTEGER REFERENCES tags(id) ON DELETE SET NULL'],
    ['epic_id', 'INTEGER REFERENCES epics(id) ON DELETE SET NULL'],
    ['cloned_from_id', 'INTEGER REFERENCES cards(id) ON DELETE SET NULL'],
    ['due_date', 'TEXT'],
    ['published_at', 'TEXT'],
  ];
  const existingNames = new Set(cardColumns.map((col) => col.name));
  columnsToAdd
    .filter(([name]) => !existingNames.has(name))
    .forEach(([name, definition]) => db.exec(`ALTER TABLE cards ADD COLUMN ${name} ${definition}`));
}

function addMissingUserColumns(userColumns) {
  if (!userColumns.some((col) => col.name === 'avatar_url')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  }
}

// Les tags existants n'avaient pas de couleur stockée (elle était dérivée de l'id à
// l'affichage) : on leur assigne une couleur en rotation dès l'ajout de la colonne, pour
// qu'ils n'apparaissent pas tous gris par défaut au moment de la migration.
function addTagColorColumn() {
  const columns = db.prepare('PRAGMA table_info(tags)').all();
  if (columns.some((col) => col.name === 'color')) return;

  db.exec("ALTER TABLE tags ADD COLUMN color TEXT NOT NULL DEFAULT 'gray'");

  const rotatingPalette = ['sky', 'emerald', 'violet', 'amber', 'rose', 'indigo'];
  const existingTags = db.prepare('SELECT id FROM tags ORDER BY id').all();
  const setColor = db.prepare('UPDATE tags SET color = ? WHERE id = ?');
  existingTags.forEach(({ id }, index) => setColor.run(rotatingPalette[index % rotatingPalette.length], id));
}

function addEmoteUrlColumn(tableName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((col) => col.name === 'emote_url')) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN emote_url TEXT`);
}

function addVisibleInFilterColumn(tableName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((col) => col.name === 'visible_in_filter')) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN visible_in_filter INTEGER NOT NULL DEFAULT 1`);
}

function addArchivedColumn() {
  const columns = db.prepare('PRAGMA table_info(tags)').all();
  if (columns.some((col) => col.name === 'archived')) return;
  db.exec('ALTER TABLE tags ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
}

// Colonne ajoutée après coup : les bases déjà existantes ont une colonne "💡Idées" qui
// n'avait jamais été restreinte. On la bascule en restreinte dès l'ajout de la colonne
// (une seule fois, puisque l'ALTER TABLE ne se produit qu'une fois par base) pour que le
// comportement par défaut du template "video" s'applique aussi aux kanbans déjà créés.
function addRestrictedColumn() {
  const columns = db.prepare('PRAGMA table_info(columns)').all();
  if (columns.some((col) => col.name === 'restricted')) return;

  db.exec('ALTER TABLE columns ADD COLUMN restricted INTEGER NOT NULL DEFAULT 0');
  db.prepare("UPDATE columns SET restricted = 1 WHERE name = '💡Idées'").run();
}

// Colonne permettant d'imbriquer 2+ colonnes (même kanban) dans un seul emplacement du
// tableau — NULL par défaut, donc aucun effet sur les bases existantes.
function addColumnGroupKeyColumn() {
  const columns = db.prepare('PRAGMA table_info(columns)').all();
  if (columns.some((col) => col.name === 'group_key')) return;
  db.exec('ALTER TABLE columns ADD COLUMN group_key TEXT');
}

// Migration historique : l'ancien mécanisme de "colonne divisée en 2 états" (ex: la
// colonne "🎬Montage" avec state_a_name="Derush"/state_b_name="Montage", et les cartes
// taguées via cards.state) devient 2 VRAIES colonnes indépendantes (statut sélectionnable
// normalement, visibles dans les notifications/filtres...), simplement affichées
// imbriquées l'une avec l'autre via group_key. Chaque colonne encore divisée (état
// state_a_name non NULL) donne naissance à une nouvelle colonne "état A" insérée juste
// avant elle (qui prend son ancienne position), la colonne existante devenant l'"état B"
// et gardant son id (donc son historique/ses notifications restent cohérents). Les
// cartes en état 'a' (ou sans état, cf cas limite déjà géré par board.ts côté lecture)
// migrent vers la nouvelle colonne ; celles en état 'b' restent sur place. No-op si déjà
// migré (state_a_name n'existe plus).
function migrateSplitColumnsToGroupedColumns() {
  const columns = db.prepare('PRAGMA table_info(columns)').all();
  if (!columns.some((col) => col.name === 'state_a_name')) return;

  const splitColumns = db.prepare('SELECT * FROM columns WHERE state_a_name IS NOT NULL').all();
  const shiftPositions = db.prepare(
    'UPDATE columns SET position = position + 1 WHERE kanban_id = ? AND position >= ?'
  );
  const insertColumn = db.prepare(
    'INSERT INTO columns (kanban_id, name, position, restricted, group_key) VALUES (?, ?, ?, ?, ?)'
  );
  const groupExistingColumn = db.prepare(
    'UPDATE columns SET group_key = ?, state_a_name = NULL, state_b_name = NULL WHERE id = ?'
  );
  const moveStateACards = db.prepare(
    "UPDATE cards SET column_id = ?, state = NULL WHERE column_id = ? AND (state IS NULL OR state = 'a')"
  );
  const clearRemainingState = db.prepare('UPDATE cards SET state = NULL WHERE column_id = ?');

  const migrateColumn = db.transaction((column) => {
    const groupKey = `split-${column.id}`;
    shiftPositions.run(column.kanban_id, column.position);
    const newColumnId = insertColumn.run(
      column.kanban_id,
      column.state_a_name,
      column.position,
      column.restricted,
      groupKey
    ).lastInsertRowid;
    groupExistingColumn.run(groupKey, column.id);
    moveStateACards.run(newColumnId, column.id);
    clearRemainingState.run(column.id);
  });
  splitColumns.forEach(migrateColumn);

  db.exec('ALTER TABLE columns DROP COLUMN state_a_name');
  db.exec('ALTER TABLE columns DROP COLUMN state_b_name');
}

function dropCardStateColumn() {
  const cardColumns = db.prepare('PRAGMA table_info(cards)').all();
  if (!cardColumns.some((col) => col.name === 'state')) return;
  db.exec('ALTER TABLE cards DROP COLUMN state');
}

function addKanbanIdColumn(tableName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((col) => col.name === 'kanban_id')) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN kanban_id INTEGER REFERENCES kanbans(id) ON DELETE CASCADE`);
  }
  // Créé après coup (plutôt que dans schema.sql) : sur une base déjà existante, la colonne
  // kanban_id ne devient disponible qu'au ALTER TABLE ci-dessus, or schema.sql s'exécute
  // avant cette fonction et un CREATE INDEX y échouerait tant que la colonne n'existe pas.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_kanban ON ${tableName}(kanban_id)`);
}

function ensureDefaultAdmin() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) return;

  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, 'admin');
  if (!silent) {
    console.log(`Admin par défaut créé (username: ${username}, password: ${password}) — pensez à changer ce mot de passe.`);
  }
}

function renameLegacyColumnNames() {
  const renameColumn = db.prepare('UPDATE columns SET name = ? WHERE name = ?');
  Object.entries(LEGACY_COLUMN_RENAMES).forEach(([oldName, newName]) => renameColumn.run(newName, oldName));
}

// L'EPIC remplace l'ancien champ libre "Chaîne YTB" : les cartes existantes dont le
// texte de channel correspond exactement au nom d'une EPIC sont rattachées à celle-ci
// avant que la colonne ne soit supprimée, pour ne pas perdre l'information.
function migrateChannelToEpic(cardColumns) {
  if (!cardColumns.some((col) => col.name === 'channel')) return;

  db.prepare(
    `UPDATE cards SET epic_id = (SELECT id FROM epics WHERE epics.name = cards.channel)
     WHERE epic_id IS NULL AND channel IS NOT NULL
       AND EXISTS (SELECT 1 FROM epics WHERE epics.name = cards.channel)`
  ).run();
  db.exec('ALTER TABLE cards DROP COLUMN channel');
  if (!silent) {
    console.log('Colonne channel migrée vers epic_id puis supprimée.');
  }
}

// Migration historique : la toute première version de l'app ne gérait qu'un seul kanban
// implicite (colonnes/tags/epics/cartes sans rattachement à un kanban). On adopte ces
// données existantes dans un kanban "TwiZzyxKanban" nommé, plutôt que de les perdre.
// Une base neuve (aucune donnée préexistante) ne déclenche pas cette adoption : elle
// démarre sans aucun kanban, à créer depuis l'interface.
function adoptLegacyBoardIfNeeded() {
  const kanbanCount = db.prepare('SELECT COUNT(*) AS count FROM kanbans').get().count;
  if (kanbanCount > 0) return;

  const legacyColumnCount = db.prepare('SELECT COUNT(*) AS count FROM columns WHERE kanban_id IS NULL').get().count;
  if (legacyColumnCount === 0) return;

  const adopt = db.transaction(() => {
    const kanbanId = db
      .prepare('INSERT INTO kanbans (name, code) VALUES (?, ?)')
      .run('TwiZzyxKanban', 'TK-TWIZZYX').lastInsertRowid;

    db.prepare('UPDATE columns SET kanban_id = ? WHERE kanban_id IS NULL').run(kanbanId);
    db.prepare('UPDATE tags SET kanban_id = ? WHERE kanban_id IS NULL').run(kanbanId);
    db.prepare('UPDATE epics SET kanban_id = ? WHERE kanban_id IS NULL').run(kanbanId);
    db.prepare('UPDATE cards SET kanban_id = ? WHERE kanban_id IS NULL').run(kanbanId);

    const assignedUsers = db
      .prepare('SELECT DISTINCT assigned_user_id AS id FROM cards WHERE kanban_id = ? AND assigned_user_id IS NOT NULL')
      .all(kanbanId);
    const insertMember = db.prepare(
      'INSERT OR IGNORE INTO kanban_members (kanban_id, user_id, is_moderator) VALUES (?, ?, 0)'
    );
    assignedUsers.forEach(({ id }) => insertMember.run(kanbanId, id));

    const moderator =
      db.prepare('SELECT id FROM users WHERE username = ?').get('TwiZzyx') ||
      db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    if (moderator) {
      db.prepare(
        `INSERT INTO kanban_members (kanban_id, user_id, is_moderator) VALUES (?, ?, 1)
         ON CONFLICT(kanban_id, user_id) DO UPDATE SET is_moderator = 1`
      ).run(kanbanId, moderator.id);
    }

    if (!silent) {
      console.log('Kanban historique "TwiZzyxKanban" (TK-TWIZZYX) créé, données existantes rattachées.');
    }
  });
  adopt();
}

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  const cardColumns = db.prepare('PRAGMA table_info(cards)').all();
  addMissingCardColumns(cardColumns);
  db.exec('CREATE INDEX IF NOT EXISTS idx_cards_kanban ON cards(kanban_id)');

  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  addMissingUserColumns(userColumns);

  addKanbanIdColumn('columns');
  addKanbanIdColumn('tags');
  addKanbanIdColumn('epics');
  addTagColorColumn();
  addEmoteUrlColumn('tags');
  addEmoteUrlColumn('epics');
  addVisibleInFilterColumn('tags');
  addVisibleInFilterColumn('epics');
  addArchivedColumn();

  renameLegacyColumnNames();
  addRestrictedColumn();
  addColumnGroupKeyColumn();
  migrateSplitColumnsToGroupedColumns();
  dropCardStateColumn();
  migrateChannelToEpic(cardColumns);
  adoptLegacyBoardIfNeeded();
  ensureDefaultAdmin();

  if (!silent) {
    console.log('DB initialisée.');
  }
}

module.exports = migrate;
