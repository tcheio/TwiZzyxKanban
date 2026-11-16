const db = require('../db/connection');
const { notify, getCardWatchers } = require('../utils/notify');
const { canViewCard } = require('../utils/kanban-access');

const MAX_TITLE_LENGTH = 500;

const TASK_SELECT = `
  SELECT t.id, t.card_id, t.title, t.position, t.assigned_user_id, t.done_at, t.done_by_user_id,
         t.created_by_user_id, t.created_at,
         assignee.username AS assigned_username, assignee.avatar_url AS assigned_avatar_url,
         done_by.username AS done_by_username
  FROM card_tasks t
  LEFT JOIN users assignee ON assignee.id = t.assigned_user_id
  LEFT JOIN users done_by ON done_by.id = t.done_by_user_id
`;

function getCardOr404(req, res) {
  const cardId = Number(req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ? AND kanban_id = ?').get(cardId, req.kanbanId);
  if (!card || !canViewCard(card, req.kanbanId, req.user)) {
    res.status(404).json({ error: 'Carte introuvable' });
    return null;
  }
  return card;
}

function fetchTask(taskId) {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(taskId);
}

function normalizeTitle(title, res) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) {
    res.status(400).json({ error: 'title requis' });
    return null;
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ error: `title ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères` });
    return null;
  }
  return trimmed;
}

// Seules les personnes reliées au ticket (responsable principal ou additionnel) peuvent
// se voir assigner une de ses tâches. Renvoie false (et répond 400) sinon.
function checkAssignee(card, assignedUserId, res) {
  if (assignedUserId === null || assignedUserId === undefined) return true;
  if (!getCardWatchers(card.id).includes(Number(assignedUserId))) {
    res.status(400).json({ error: "assigned_user_id doit être l'un des responsables du ticket" });
    return false;
  }
  return true;
}

function notifyTaskAssignee(req, card, task) {
  if (!task.assigned_user_id) return;
  notify([task.assigned_user_id], {
    kanbanId: req.kanbanId,
    cardId: card.id,
    actorUserId: req.user.id,
    type: 'assignee',
    message: `${req.user.username} vous a assigné la tâche « ${task.title} » du ticket « ${card.title} »`,
  });
}

function list(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;
  const tasks = db.prepare(`${TASK_SELECT} WHERE t.card_id = ? ORDER BY t.position ASC, t.id ASC`).all(card.id);
  res.json(tasks);
}

function create(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const { title, assigned_user_id } = req.body || {};
  const trimmedTitle = normalizeTitle(title, res);
  if (trimmedTitle === null) return;
  if (!checkAssignee(card, assigned_user_id, res)) return;

  const { next } = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS next FROM card_tasks WHERE card_id = ?')
    .get(card.id);
  const result = db
    .prepare(
      `INSERT INTO card_tasks (card_id, title, position, assigned_user_id, created_by_user_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(card.id, trimmedTitle, next, assigned_user_id ?? null, req.user.id);

  const task = fetchTask(result.lastInsertRowid);
  notifyTaskAssignee(req, card, task);
  res.status(201).json(task);
}

function update(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const taskId = Number(req.params.taskId);
  const task = db.prepare('SELECT * FROM card_tasks WHERE id = ? AND card_id = ?').get(taskId, card.id);
  if (!task) {
    return res.status(404).json({ error: 'Tâche introuvable' });
  }

  const { title, assigned_user_id, done } = req.body || {};
  const sets = [];
  const params = [];

  if (title !== undefined) {
    const trimmedTitle = normalizeTitle(title, res);
    if (trimmedTitle === null) return;
    sets.push('title = ?');
    params.push(trimmedTitle);
  }
  if (assigned_user_id !== undefined) {
    if (!checkAssignee(card, assigned_user_id, res)) return;
    sets.push('assigned_user_id = ?');
    params.push(assigned_user_id);
  }
  if (done !== undefined) {
    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done doit être un booléen' });
    }
    // On ne réécrit pas la date/l'auteur si la tâche était déjà dans cet état.
    if (done && !task.done_at) {
      sets.push("done_at = datetime('now')", 'done_by_user_id = ?');
      params.push(req.user.id);
    } else if (!done && task.done_at) {
      sets.push('done_at = NULL', 'done_by_user_id = NULL');
    }
  }

  if (sets.length) {
    db.prepare(`UPDATE card_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params, task.id);
  }

  const updated = fetchTask(task.id);
  if (assigned_user_id !== undefined && assigned_user_id !== null && Number(assigned_user_id) !== task.assigned_user_id) {
    notifyTaskAssignee(req, card, updated);
  }
  res.json(updated);
}

function remove(req, res) {
  const card = getCardOr404(req, res);
  if (!card) return;

  const taskId = Number(req.params.taskId);
  const result = db.prepare('DELETE FROM card_tasks WHERE id = ? AND card_id = ?').run(taskId, card.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Tâche introuvable' });
  }
  res.status(204).send();
}

module.exports = { list, create, update, remove };
