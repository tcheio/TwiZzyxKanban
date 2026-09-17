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

// Les tags additionnels (card_tags) sont ramenés en un tableau `tag_ids` embarqué sur la
// carte elle-même (plutôt qu'un appel séparé comme pour les responsables) : le tableau
// (board) affiche toutes les cartes d'un coup et doit pouvoir montrer ces tags sans
// multiplier les requêtes par carte.
function mapCardTags(card) {
  const { extra_tag_ids, ...rest } = card;
  return { ...rest, tag_ids: extra_tag_ids ? extra_tag_ids.split(',').map(Number) : [] };
}

function fetchCardWithTags(id) {
  const card = db
    .prepare(
      `SELECT cards.*,
              (SELECT GROUP_CONCAT(tag_id) FROM card_tags WHERE card_tags.card_id = cards.id) AS extra_tag_ids
       FROM cards WHERE cards.id = ?`
    )
    .get(id);
  return card ? mapCardTags(card) : card;
}

module.exports = {
  PUBLISHED_COLUMN_NAME,
  CANCELLED_STATUS_LABEL,
  isPublishedColumn,
  statusLabelFor,
  withKey,
  mapCardTags,
  fetchCardWithTags,
};
