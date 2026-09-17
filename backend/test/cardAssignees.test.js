const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let cardId;
let aliceId;
let aliceToken;
let bobId;

async function createUser(username, role = 'user') {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: `${username}123`, role });
  const token = await loginAs(username, `${username}123`);
  return { id: res.body.id, token };
}

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  columns = created.columns;

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo A', column_id: columns[0].id });
  cardId = card.body.id;

  const alice = await createUser('alice');
  aliceId = alice.id;
  aliceToken = alice.token;
  await addMember(adminToken, kanbanId, aliceId, false);

  const bob = await createUser('bob');
  bobId = bob.id;
  await addMember(adminToken, kanbanId, bobId, false);
});

test('GET /assignees sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`);
  assert.equal(res.status, 401);
});

test('GET /assignees est vide au départ', async () => {
  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /assignment-history est vide au départ', async () => {
  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignment-history`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /assignees avec action invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'delete', user_id: aliceId, reason: 'test' });
  assert.equal(res.status, 400);
});

test('POST /assignees sans reason retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId });
  assert.equal(res.status, 400);
});

test('POST /assignees avec un user_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: 9999, reason: 'test' });
  assert.equal(res.status, 400);
});

test('POST /assignees (add) ajoute un responsable additionnel', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort sur ce ticket' });
  assert.equal(res.status, 201);

  const list = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].user_id, aliceId);
  assert.equal(list.body[0].username, 'alice');
});

test('POST /assignees (add) en double retourne 400', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort' });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Encore' });
  assert.equal(res.status, 400);
});

test('POST /assignees (replace) change le responsable principal', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'replace', user_id: aliceId, reason: 'Bob est en congés' });
  assert.equal(res.status, 201);
  assert.equal(res.body.assigned_user_id, aliceId);
});

test('POST /assignees (replace) retire la personne de la liste des additionnels si besoin', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort' });

  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'replace', user_id: aliceId, reason: 'Promue responsable' });

  const list = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(list.body, []);
});

test("POST /assignees (replace) vers la personne déjà responsable retourne 400", async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'replace', user_id: aliceId, reason: 'X' });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'replace', user_id: aliceId, reason: 'Y' });
  assert.equal(res.status, 400);
});

test('POST /assignees enregistre une entrée dans l\'historique', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'replace', user_id: aliceId, reason: 'Bob est en congés' });

  const history = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignment-history`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].action, 'replace');
  assert.equal(history.body[0].reason, 'Bob est en congés');
  assert.equal(history.body[0].new_user_id, aliceId);
  assert.equal(history.body[0].new_username, 'alice');
  assert.equal(history.body[0].previous_user_id, null);
  assert.equal(history.body[0].performed_by_username, 'admin');
  // Pas de changement de statut demandé : pas de snapshot de statut enregistré.
  assert.equal(history.body[0].previous_status, null);
  assert.equal(history.body[0].new_status, null);
});

test('POST /assignees avec new_column_id change aussi le statut et le trace', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort', new_column_id: columns[2].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.column_id, columns[2].id);

  const history = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignment-history`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(history.body[0].previous_status, columns[0].name);
  assert.equal(history.body[0].new_status, columns[2].name);
});

test('POST /assignees avec cancel:true annule le ticket', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort', cancel: true });
  assert.equal(res.status, 201);
  assert.ok(res.body.cancelled_at);
});

test('POST /assignees avec new_column_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort', new_column_id: 9999 });
  assert.equal(res.status, 400);
});

test('POST /assignees refuse un changement de statut sur un ticket publié', async () => {
  const published = columns.find((c) => c.name === '✅Publié');
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${cardId}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: published.id });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort', new_column_id: columns[0].id });
  assert.equal(res.status, 400);
});

test("POST /assignees par un membre simple (non modérateur) réussit", async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ action: 'add', user_id: bobId, reason: 'Renfort' });
  assert.equal(res.status, 201);
});

test('DELETE /assignees/:userId retire un responsable additionnel et le trace', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort' });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees/${aliceId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const list = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(list.body, []);

  const history = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/assignment-history`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(history.body[0].action, 'remove');
  assert.equal(history.body[0].previous_user_id, aliceId);
});

test('DELETE /assignees/:userId sur une assignation inexistante retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees/${aliceId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET /assignees sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/9999/assignees`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
