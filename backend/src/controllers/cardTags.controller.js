const db = require('../db/connection');
const { withKey, fetchCardWithTags } = require('../utils/card-status');

function getCardOr404(req, res) {
  const cardId = Number(req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(cardId, req.kanbanId);
  if (!card) {
    res.status(404).json({ error: 'Carte introuvable' });
    return null;
  }
  return card;
}

// Tags additionnels : pas d'historique ni de raison à fournir (contrairement aux
// responsables additionnels), juste un ajout/retrait simple d'une association.
function addCardTag(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const { tag_id } = req.body || {};
  if (!tag_id) {
    return res.status(400).json({ error: 'tag_id requis' });
  }

  const tag = db.prepare('SELECT id FROM tags WHERE id = ? AND kanban_id = ?').get(tag_id, req.kanbanId);
  if (!tag) {
    return res.status(400).json({ error: 'tag_id invalide' });
  }
  if (card.tag_id === Number(tag_id)) {
    return res.status(400).json({ error: 'Ce tag est déjà le tag principal du ticket' });
  }
  const existing = db.prepare('SELECT 1 FROM card_tags WHERE card_id = ? AND tag_id = ?').get(card.id, tag_id);
  if (existing) {
    return res.status(400).json({ error: 'Ce tag est déjà associé à ce ticket' });
  }

  db.prepare('INSERT INTO card_tags (card_id, tag_id) VALUES (?, ?)').run(card.id, tag_id);

  const updated = fetchCardWithTags(card.id);
  res.status(201).json(withKey(updated, req.kanbanCode));
}

function removeCardTag(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;
  const tagId = Number(req.params.tagId);

  const existing = db.prepare('SELECT 1 FROM card_tags WHERE card_id = ? AND tag_id = ?').get(card.id, tagId);
  if (!existing) {
    return res.status(404).json({ error: 'Association introuvable' });
  }

  db.prepare('DELETE FROM card_tags WHERE card_id = ? AND tag_id = ?').run(card.id, tagId);

  const updated = fetchCardWithTags(card.id);
  res.json(withKey(updated, req.kanbanCode));
}

module.exports = { addCardTag, removeCardTag };
