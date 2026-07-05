const db = require('../db/connection');

function list(req, res) {
  const cardId = Number(req.params.id);
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }

  const comments = db
    .prepare(
      `SELECT comments.id, comments.card_id, comments.user_id, comments.body, comments.created_at,
              users.username AS username
       FROM comments
       LEFT JOIN users ON users.id = comments.user_id
       WHERE comments.card_id = ?
       ORDER BY comments.created_at ASC, comments.id ASC`
    )
    .all(cardId);
  res.json(comments);
}

function create(req, res) {
  const cardId = Number(req.params.id);
  const { body } = req.body || {};

  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return res.status(404).json({ error: 'Carte introuvable' });
  }
  if (!body?.trim()) {
    return res.status(400).json({ error: 'body requis' });
  }

  const result = db
    .prepare('INSERT INTO comments (card_id, user_id, body) VALUES (?, ?, ?)')
    .run(cardId, req.user.id, body.trim());

  const comment = db
    .prepare(
      `SELECT comments.id, comments.card_id, comments.user_id, comments.body, comments.created_at,
              users.username AS username
       FROM comments
       LEFT JOIN users ON users.id = comments.user_id
       WHERE comments.id = ?`
    )
    .get(result.lastInsertRowid);
  res.status(201).json(comment);
}

function remove(req, res) {
  const cardId = Number(req.params.id);
  const commentId = Number(req.params.commentId);

  const comment = db
    .prepare('SELECT * FROM comments WHERE id = ? AND card_id = ?')
    .get(commentId, cardId);
  if (!comment) {
    return res.status(404).json({ error: 'Commentaire introuvable' });
  }
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres commentaires" });
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  res.status(204).send();
}

module.exports = { list, create, remove };
