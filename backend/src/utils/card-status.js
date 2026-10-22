const db = require('../db/connection');

const PUBLISHED_COLUMN_NAME = '✅Publié';
// Doit rester aligné avec CANCELLED_STATUS_LABEL côté frontend (shared/ticket-status.ts).
const CANCELLED_STATUS_LABEL = '🚫 Annulé';

function isPublishedColumn(columnId) {
  const column = db.prepare('SELECT name FROM columns WHERE id = ?').get(columnId);
  return column?.name === PUBLISHED_COLUMN_NAME;
}

function statusLabelFor(card) {
  if (card.cancelled_at) return CANCELLED_STATUS_LABEL;
  const column = db.prepare('SELECT name FROM columns WHERE id = ?').get(card.column_id);
  return column?.name ?? '—';
}

function withKey(card, kanbanCode) {
  return { ...card, key: `${kanbanCode}-${card.id}` };
}

// Journalise l'entrée d'une carte dans une colonne (création, ou changement de colonne —
// jamais un simple réordonnancement) pour les statistiques de temps passé par colonne
// (cf utils/stats.js). `enteredAt` optionnel sert aux tests pour forcer une date précise.
function logColumnEntry(cardId, columnId, enteredAt) {
  if (enteredAt) {
    db.prepare('INSERT INTO card_column_history (card_id, column_id, entered_at) VALUES (?, ?, ?)').run(
      cardId,
      columnId,
      enteredAt
    );
  } else {
    db.prepare('INSERT INTO card_column_history (card_id, column_id) VALUES (?, ?)').run(cardId, columnId);
  }
}

// Les tags/responsables additionnels (card_tags / card_assignees) sont ramenés en
// tableaux `tag_ids` / `assignee_ids` embarqués sur la carte elle-même (plutôt qu'un
// appel séparé par carte) : le tableau (board) affiche toutes les cartes d'un coup et
// doit pouvoir montrer ces associations sans multiplier les requêtes.
const EXTRA_RELATIONS_SUBQUERY = `
  (SELECT GROUP_CONCAT(tag_id) FROM card_tags WHERE card_tags.card_id = cards.id) AS extra_tag_ids,
  (SELECT GROUP_CONCAT(user_id) FROM card_assignees WHERE card_assignees.card_id = cards.id) AS extra_assignee_ids
`;

function mapCardRelations(card) {
  const { extra_tag_ids, extra_assignee_ids, ...rest } = card;
  return {
    ...rest,
    tag_ids: extra_tag_ids ? extra_tag_ids.split(',').map(Number) : [],
    assignee_ids: extra_assignee_ids ? extra_assignee_ids.split(',').map(Number) : [],
  };
}

function fetchCardWithRelations(id) {
  const card = db
    .prepare(`SELECT cards.*, ${EXTRA_RELATIONS_SUBQUERY} FROM cards WHERE cards.id = ?`)
    .get(id);
  return card ? mapCardRelations(card) : card;
}

module.exports = {
  PUBLISHED_COLUMN_NAME,
  CANCELLED_STATUS_LABEL,
  isPublishedColumn,
  statusLabelFor,
  withKey,
  EXTRA_RELATIONS_SUBQUERY,
  mapCardRelations,
  fetchCardWithRelations,
  logColumnEntry,
};
