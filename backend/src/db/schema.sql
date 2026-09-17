CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','user')),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kanbans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kanban_members (
  kanban_id INTEGER NOT NULL REFERENCES kanbans(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_moderator INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kanban_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kanban_members_user ON kanban_members(user_id);

CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kanban_id INTEGER REFERENCES kanbans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kanban_id INTEGER REFERENCES kanbans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  emote_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS epics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kanban_id INTEGER REFERENCES kanbans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kanban_id INTEGER REFERENCES kanbans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL,
  cloned_from_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
  column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  due_date TEXT,
  published_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id);

CREATE TABLE IF NOT EXISTS card_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  linked_card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('before','after')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_links_card ON card_links(card_id);
CREATE INDEX IF NOT EXISTS idx_card_links_linked ON card_links(linked_card_id);

CREATE TABLE IF NOT EXISTS card_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_images_card ON card_images(card_id);

-- Responsables additionnels d'un ticket, en plus du responsable principal
-- (cards.assigned_user_id). Une personne ne peut pas être à la fois responsable
-- principal et responsable additionnel du même ticket (géré côté applicatif).
CREATE TABLE IF NOT EXISTS card_assignees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (card_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_card_assignees_card ON card_assignees(card_id);

-- Historique des ajouts/remplacements/retraits de responsable, avec la raison donnée et
-- l'éventuel changement de statut effectué dans la même action.
CREATE TABLE IF NOT EXISTS card_assignment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('add','replace','remove')),
  previous_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  new_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  previous_status TEXT,
  new_status TEXT,
  performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_assignment_history_card ON card_assignment_history(card_id);
