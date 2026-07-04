const db = require('../db/connection');

const VALID_TYPES = ['before', 'after'];

function list(req, res) {
  const cardId = Number(req.params.id);
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }

  const links = db
    .prepare(
      `SELECT id, card_id, linked_card_id, type, created_at
       FROM card_links
       WHERE card_id = ? OR linked_card_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(cardId, cardId);
  res.json(links);
}

function create(req, res) {
  const cardId = Number(req.params.id);
  const { linked_card_id, type } = req.body || {};

  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  if (!linked_card_id || !type) {
    return res.status(400).json({ error: 'linked_card_id et type requis' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type doit être l'un de: ${VALID_TYPES.join(', ')}` });
  }
  if (Number(linked_card_id) === cardId) {
    return res.status(400).json({ error: 'Un ticket ne peut pas être lié à lui-même' });
  }

  const linkedCard = db.prepare('SELECT id FROM cards WHERE id = ?').get(linked_card_id);
  if (!linkedCard) {
    return res.status(400).json({ error: 'linked_card_id invalide' });
  }

  const existing = db
    .prepare('SELECT id FROM card_links WHERE card_id = ? AND linked_card_id = ? AND type = ?')
    .get(cardId, linked_card_id, type);
  if (existing) {
    return res.status(400).json({ error: 'Ce lien existe déjà' });
  }

  const result = db
    .prepare('INSERT INTO card_links (card_id, linked_card_id, type) VALUES (?, ?, ?)')
    .run(cardId, linked_card_id, type);

  const link = db.prepare('SELECT id, card_id, linked_card_id, type, created_at FROM card_links WHERE id = ?').get(
    result.lastInsertRowid
  );
  res.status(201).json(link);
}

function remove(req, res) {
  const cardId = Number(req.params.id);
  const linkId = Number(req.params.linkId);

  const link = db
    .prepare('SELECT * FROM card_links WHERE id = ? AND (card_id = ? OR linked_card_id = ?)')
    .get(linkId, cardId, cardId);
  if (!link) {
    return res.status(404).json({ error: 'Lien introuvable' });
  }

  db.prepare('DELETE FROM card_links WHERE id = ?').run(linkId);
  res.status(204).send();
}

module.exports = { list, create, remove };
