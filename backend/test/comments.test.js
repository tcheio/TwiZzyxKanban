const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let cardId;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo', column_id: created.columns[0].id });
  cardId = card.body.id;
});

test('GET /comments sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`);
  assert.equal(res.status, 401);
});

test('GET /comments est vide au départ', async () => {
  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /comments crée un commentaire avec le username', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Premier commentaire' });
  assert.equal(res.status, 201);
  assert.equal(res.body.body, 'Premier commentaire');
  assert.equal(res.body.username, 'admin');
  assert.equal(res.body.card_id, cardId);
});

test('POST /comments avec un body vide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: '   ' });
  assert.equal(res.status, 400);
});

test('POST /comments sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/9999/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'X' });
  assert.equal(res.status, 404);
});

test('GET /comments liste les commentaires créés, triés par date', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Premier' });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Deuxième' });

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((c) => c.body),
    ['Premier', 'Deuxième']
  );
});

test("DELETE par l'auteur supprime le commentaire", async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'À supprimer' });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/comments/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE par un autre utilisateur non-admin retourne 403', async () => {
  const aliceRes = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  await addMember(adminToken, kanbanId, aliceRes.body.id, false);
  const aliceToken = await loginAs('alice', 'alice123');

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Commentaire admin' });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/comments/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 403);
});

test("DELETE par un admin sur le commentaire de quelqu'un d'autre fonctionne", async () => {
  const aliceRes = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  await addMember(adminToken, kanbanId, aliceRes.body.id, false);
  const aliceToken = await loginAs('alice', 'alice123');

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ body: 'Commentaire alice' });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/comments/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE sur un commentaire inexistant retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/comments/9999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
