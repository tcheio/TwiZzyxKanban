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

module.exports = { PUBLISHED_COLUMN_NAME, CANCELLED_STATUS_LABEL, isPublishedColumn, statusLabelFor, withKey };
