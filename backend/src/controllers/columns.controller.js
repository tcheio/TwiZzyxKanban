const db = require('../db/connection');

function withRestrictedBool(column) {
  return { ...column, restricted: !!column.restricted };
}

// Les 2 états d'une colonne divisée sont renseignés ensemble ou absents ensemble — pas
// de colonne divisée en un seul état. Renvoie un message d'erreur, ou null si valide.
// `current` contient les valeurs déjà en base, utilisées quand un seul des deux champs
// est envoyé (PATCH partiel) pour savoir si le résultat final serait incohérent.
function validateStateNames(stateAName, stateBName, current = {}) {
  const finalA = stateAName !== undefined ? stateAName : current.state_a_name;
  const finalB = stateBName !== undefined ? stateBName : current.state_b_name;
  if (!!finalA !== !!finalB) {
    return 'state_a_name et state_b_name doivent être renseignés ou absents ensemble';
  }
  return null;
}

function list(req, res) {
  const columns = db.prepare('SELECT * FROM columns WHERE kanban_id = ? ORDER BY position').all(req.kanbanId);
  res.json(columns.map(withRestrictedBool));
}

function create(req, res) {
  const { name, restricted, state_a_name, state_b_name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (restricted !== undefined && typeof restricted !== 'boolean') {
    return res.status(400).json({ error: 'restricted doit être un booléen' });
  }
  const stateError = validateStateNames(state_a_name || null, state_b_name || null);
  if (stateError) {
    return res.status(400).json({ error: stateError });
  }

  const maxPosition = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM columns WHERE kanban_id = ?')
    .get(req.kanbanId).maxPos;

  const result = db
    .prepare(
      'INSERT INTO columns (kanban_id, name, position, restricted, state_a_name, state_b_name) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(req.kanbanId, name, maxPosition + 1, restricted ? 1 : 0, state_a_name || null, state_b_name || null);

  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(withRestrictedBool(column));
}

function update(req, res) {
  const id = Number(req.params.id);
  const { name, restricted, state_a_name, state_b_name } = req.body || {};

  const column = db.prepare('SELECT * FROM columns WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!column) {
    return res.status(404).json({ error: 'Colonne introuvable' });
  }
  if (name !== undefined && !name) {
    return res.status(400).json({ error: 'name requis' });
  }
  if (restricted !== undefined && typeof restricted !== 'boolean') {
    return res.status(400).json({ error: 'restricted doit être un booléen' });
  }
  const normalizedA = state_a_name !== undefined ? state_a_name || null : undefined;
  const normalizedB = state_b_name !== undefined ? state_b_name || null : undefined;
  const stateError = validateStateNames(normalizedA, normalizedB, column);
  if (stateError) {
    return res.status(400).json({ error: stateError });
  }

  const nextStateA = normalizedA !== undefined ? normalizedA : column.state_a_name;
  const nextStateB = normalizedB !== undefined ? normalizedB : column.state_b_name;
  const wasSplit = !!column.state_a_name;
  const willBeSplit = !!nextStateA;

  db.prepare(
    'UPDATE columns SET name = ?, restricted = ?, state_a_name = ?, state_b_name = ? WHERE id = ?'
  ).run(
    name || column.name,
    restricted !== undefined ? (restricted ? 1 : 0) : column.restricted,
    nextStateA,
    nextStateB,
    id
  );

  // La colonne redevient non divisée : les cartes perdent leur état, qui n'a plus de sens.
  if (wasSplit && !willBeSplit) {
    db.prepare('UPDATE cards SET state = NULL WHERE column_id = ?').run(id);
  }
  // La colonne devient divisée : les cartes déjà présentes rejoignent le premier état
  // plutôt que de disparaître des 2 sous-listes.
  if (!wasSplit && willBeSplit) {
    db.prepare("UPDATE cards SET state = 'a' WHERE column_id = ? AND state IS NULL").run(id);
  }

  const updated = db.prepare('SELECT * FROM columns WHERE id = ?').get(id);
  res.json(withRestrictedBool(updated));
}

function remove(req, res) {
  const id = Number(req.params.id);

  const column = db.prepare('SELECT * FROM columns WHERE id = ? AND kanban_id = ?').get(id, req.kanbanId);
  if (!column) {
    return res.status(404).json({ error: 'Colonne introuvable' });
  }

  const cardCount = db
    .prepare('SELECT COUNT(*) AS count FROM cards WHERE column_id = ?')
    .get(id).count;
  if (cardCount > 0) {
    return res.status(409).json({ error: 'Impossible de supprimer une colonne contenant des cartes' });
  }

  db.prepare('DELETE FROM columns WHERE id = ?').run(id);
  res.status(204).send();
}

function reorder(req, res) {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'orderedIds (tableau) requis' });
  }

  const totalColumns = db.prepare('SELECT COUNT(*) AS count FROM columns WHERE kanban_id = ?').get(req.kanbanId).count;
  const ownedCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM columns WHERE kanban_id = ? AND id IN (${orderedIds.map(() => '?').join(',')})`
    )
    .get(req.kanbanId, ...orderedIds).count;
  if (orderedIds.length !== totalColumns || ownedCount !== orderedIds.length) {
    return res.status(400).json({ error: 'orderedIds doit contenir exactement les colonnes de ce kanban' });
  }

  const update = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
  const reorderTx = db.transaction((ids) => {
    ids.forEach((columnId, index) => update.run(index, columnId));
  });
  reorderTx(orderedIds);

  const columns = db.prepare('SELECT * FROM columns WHERE kanban_id = ? ORDER BY position').all(req.kanbanId);
  res.json(columns);
}

module.exports = { list, create, update, remove, reorder };
