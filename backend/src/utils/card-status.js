const db = require('../db/connection');

const PUBLISHED_COLUMN_NAME = '✅Publié';
// Doit rester aligné avec CANCELLED_STATUS_LABEL côté frontend (shared/ticket-status.ts).
const CANCELLED_STATUS_LABEL = '🚫 Annulé';

function isPublishedColumn(columnId) {
  const column = db.prepare('SELECT name FROM columns WHERE id = ?').get(columnId);
  return column?.name === PUBLISHED_COLUMN_NAME;
}

// Nom de colonne complété par le nom de l'état (ex: "🎬Montage (Derush)") quand la
// colonne est divisée en 2 états (cf columns.state_a_name/state_b_name) et que la carte
// est dans l'un d'eux ; sinon simplement le nom de la colonne.
function columnStateLabel(column, state) {
  if (!column) return '—';
  if (state === 'a' && column.state_a_name) return `${column.name} (${column.state_a_name})`;
  if (state === 'b' && column.state_b_name) return `${column.name} (${column.state_b_name})`;
  return column.name;
}

function statusLabelFor(card) {
  if (card.cancelled_at) return CANCELLED_STATUS_LABEL;
  const column = db
    .prepare('SELECT name, state_a_name, state_b_name FROM columns WHERE id = ?')
    .get(card.column_id);
  return columnStateLabel(column, card.state);
}

function withKey(card, kanbanCode) {
  return { ...card, key: `${kanbanCode}-${card.id}` };
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
  columnStateLabel,
  statusLabelFor,
  withKey,
  EXTRA_RELATIONS_SUBQUERY,
  mapCardRelations,
  fetchCardWithRelations,
};
