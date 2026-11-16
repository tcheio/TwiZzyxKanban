const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, db, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let cardId;
let aliceId;
let aliceToken;
let bobId;
let bobToken;
let carolId;

async function createUser(username) {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: `${username}123`, role: 'user' });
  const token = await loginAs(username, `${username}123`);
  return { id: res.body.id, token };
}

function tasksUrl(id = cardId) {
  return `/api/kanbans/${kanbanId}/cards/${id}/tasks`;
}

async function createTask(body, token = adminToken) {
  return request(app).post(tasksUrl()).set('Authorization', `Bearer ${token}`).send(body);
}

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  columns = created.columns;

  const alice = await createUser('alice');
  aliceId = alice.id;
  aliceToken = alice.token;
  await addMember(adminToken, kanbanId, aliceId, false);

  const bob = await createUser('bob');
  bobId = bob.id;
  bobToken = bob.token;
  await addMember(adminToken, kanbanId, bobId, false);

  const carol = await createUser('carol');
  carolId = carol.id;
  await addMember(adminToken, kanbanId, carolId, false);

  // Colonne non restreinte, alice responsable principale, bob responsable additionnel.
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo A', column_id: columns[1].id, assigned_user_id: aliceId });
  cardId = card.body.id;
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: bobId });
});

test('GET /tasks sans token retourne 401', async () => {
  const res = await request(app).get(tasksUrl());
  assert.equal(res.status, 401);
});

test('GET /tasks est vide au départ', async () => {
  const res = await request(app).get(tasksUrl()).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /tasks crée une tâche non terminée, en fin de liste', async () => {
  const first = await createTask({ title: '  Écrire le script  ' });
  assert.equal(first.status, 201);
  assert.equal(first.body.title, 'Écrire le script');
  assert.equal(first.body.done_at, null);
  assert.equal(first.body.assigned_user_id, null);

  const second = await createTask({ title: 'Tourner' });
  assert.ok(second.body.position > first.body.position);

  const list = await request(app).get(tasksUrl()).set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(
    list.body.map((t) => t.title),
    ['Écrire le script', 'Tourner']
  );
});

test('POST /tasks sans titre retourne 400', async () => {
  const res = await createTask({ title: '   ' });
  assert.equal(res.status, 400);
});

test('POST /tasks accepte un responsable principal ou additionnel du ticket', async () => {
  const toAlice = await createTask({ title: 'A', assigned_user_id: aliceId });
  assert.equal(toAlice.status, 201);
  assert.equal(toAlice.body.assigned_user_id, aliceId);
  assert.equal(toAlice.body.assigned_username, 'alice');

  const toBob = await createTask({ title: 'B', assigned_user_id: bobId });
  assert.equal(toBob.status, 201);
  assert.equal(toBob.body.assigned_user_id, bobId);
});

test("POST /tasks refuse une personne qui n'est pas reliée au ticket", async () => {
  const res = await createTask({ title: 'A', assigned_user_id: carolId });
  assert.equal(res.status, 400);
});

test('un simple membre du kanban peut gérer les tâches', async () => {
  const res = await createTask({ title: 'A' }, bobToken);
  assert.equal(res.status, 201);
});

test('PATCH /tasks/:taskId coche puis décoche une tâche', async () => {
  const task = await createTask({ title: 'A' });

  const done = await request(app)
    .patch(`${tasksUrl()}/${task.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ done: true });
  assert.equal(done.status, 200);
  assert.ok(done.body.done_at);
  assert.equal(done.body.done_by_user_id, aliceId);
  assert.equal(done.body.done_by_username, 'alice');

  const undone = await request(app)
    .patch(`${tasksUrl()}/${task.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ done: false });
  assert.equal(undone.body.done_at, null);
  assert.equal(undone.body.done_by_user_id, null);
});

test('PATCH /tasks/:taskId avec done non booléen retourne 400', async () => {
  const task = await createTask({ title: 'A' });
  const res = await request(app)
    .patch(`${tasksUrl()}/${task.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ done: 'oui' });
  assert.equal(res.status, 400);
});

test('PATCH /tasks/:taskId renomme et (dés)assigne une tâche', async () => {
  const task = await createTask({ title: 'A' });

  const renamed = await request(app)
    .patch(`${tasksUrl()}/${task.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B', assigned_user_id: bobId });
  assert.equal(renamed.body.title, 'B');
  assert.equal(renamed.body.assigned_user_id, bobId);

  const unassigned = await request(app)
    .patch(`${tasksUrl()}/${task.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ assigned_user_id: null });
  assert.equal(unassigned.body.assigned_user_id, null);

  const invalid = await request(app)
    .patch(`${tasksUrl()}/${task.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ assigned_user_id: carolId });
  assert.equal(invalid.status, 400);
});

test("PATCH /tasks/:taskId sur une tâche d'un autre ticket retourne 404", async () => {
  const task = await createTask({ title: 'A' });
  const other = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo B', column_id: columns[1].id });

  const res = await request(app)
    .patch(`${tasksUrl(other.body.id)}/${task.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ done: true });
  assert.equal(res.status, 404);
});

test('DELETE /tasks/:taskId supprime une tâche', async () => {
  const task = await createTask({ title: 'A' });
  const res = await request(app).delete(`${tasksUrl()}/${task.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const again = await request(app).delete(`${tasksUrl()}/${task.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(again.status, 404);
});

test("assigner une tâche notifie la personne assignée (sauf si c'est l'auteur)", async () => {
  await createTask({ title: 'Monter la vidéo', assigned_user_id: bobId });
  await createTask({ title: 'Auto-assignée', assigned_user_id: aliceId }, aliceToken);

  const bobNotifs = db.prepare('SELECT message FROM notifications WHERE user_id = ?').all(bobId);
  assert.ok(bobNotifs.some((n) => n.message.includes('Monter la vidéo')));
  const aliceNotifs = db.prepare('SELECT message FROM notifications WHERE user_id = ?').all(aliceId);
  assert.ok(!aliceNotifs.some((n) => n.message.includes('Auto-assignée')));
});

test('la carte expose tasks_done / tasks_total', async () => {
  const a = await createTask({ title: 'A' });
  await createTask({ title: 'B' });
  await request(app)
    .patch(`${tasksUrl()}/${a.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ done: true });

  const one = await request(app).get(`/api/kanbans/${kanbanId}/cards/${cardId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(one.body.tasks_total, 2);
  assert.equal(one.body.tasks_done, 1);

  const all = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${adminToken}`);
  const card = all.body.find((c) => c.id === cardId);
  assert.equal(card.tasks_total, 2);
  assert.equal(card.tasks_done, 1);
});

test('retirer un responsable additionnel désassigne ses tâches', async () => {
  const task = await createTask({ title: 'A', assigned_user_id: bobId });
  await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees/${bobId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Plus dispo' });

  const list = await request(app).get(tasksUrl()).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.body.find((t) => t.id === task.body.id).assigned_user_id, null);
});

test('remplacer un responsable transfère ses tâches à son remplaçant', async () => {
  const aliceTask = await createTask({ title: 'A', assigned_user_id: aliceId });
  const bobTask = await createTask({ title: 'B', assigned_user_id: bobId });

  // Remplacement du principal (alice → carol).
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'replace', user_id: carolId, reason: 'Congés' });

  const list = await request(app).get(tasksUrl()).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.body.find((t) => t.id === aliceTask.body.id).assigned_user_id, carolId);
  assert.equal(list.body.find((t) => t.id === bobTask.body.id).assigned_user_id, bobId);
});

test('changer le responsable principal via PATCH /cards transfère ses tâches', async () => {
  const task = await createTask({ title: 'A', assigned_user_id: aliceId });
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${cardId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ assigned_user_id: carolId });

  let list = await request(app).get(tasksUrl()).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.body.find((t) => t.id === task.body.id).assigned_user_id, carolId);

  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${cardId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ assigned_user_id: null });
  list = await request(app).get(tasksUrl()).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.body.find((t) => t.id === task.body.id).assigned_user_id, null);
});

test("les tâches d'un ticket en colonne restreinte sont invisibles pour un non-assigné", async () => {
  const restricted = columns.find((c) => c.restricted);
  const hidden = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Idée secrète', column_id: restricted.id });

  const res = await request(app).get(tasksUrl(hidden.body.id)).set('Authorization', `Bearer ${bobToken}`);
  assert.equal(res.status, 404);
});

test('supprimer le ticket supprime ses tâches', async () => {
  await createTask({ title: 'A' });
  await request(app).delete(`/api/kanbans/${kanbanId}/cards/${cardId}`).set('Authorization', `Bearer ${adminToken}`);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM card_tasks WHERE card_id = ?').get(cardId);
  assert.equal(count, 0);
});
