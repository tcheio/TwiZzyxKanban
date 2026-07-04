const db = require('../db/connection');

const DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp);base64,/;

function list(req, res) {
  const cardId = Number(req.params.id);
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }

  const images = db
    .prepare(
      `SELECT id, card_id, data_url, created_at
       FROM card_images
       WHERE card_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(cardId);
  res.json(images);
}

function create(req, res) {
  const cardId = Number(req.params.id);
  const { data_url } = req.body || {};

  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  if (!data_url || !DATA_URL_RE.test(data_url)) {
    return res.status(400).json({ error: 'data_url doit être une image encodée (png, jpeg, gif ou webp)' });
  }

  const result = db.prepare('INSERT INTO card_images (card_id, data_url) VALUES (?, ?)').run(cardId, data_url);
  const image = db
    .prepare('SELECT id, card_id, data_url, created_at FROM card_images WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(image);
}

function remove(req, res) {
  const cardId = Number(req.params.id);
  const imageId = Number(req.params.imageId);

  const image = db.prepare('SELECT id FROM card_images WHERE id = ? AND card_id = ?').get(imageId, cardId);
  if (!image) {
    return res.status(404).json({ error: 'Image introuvable' });
  }

  db.prepare('DELETE FROM card_images WHERE id = ?').run(imageId);
  res.status(204).send();
}

module.exports = { list, create, remove };
