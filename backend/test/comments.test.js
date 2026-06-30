const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

let adminToken;
let cardId;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const columns = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);
  const card = await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo', column_id: columns.body[0].id });
  cardId = card.body.id;
});

test('GET /api/cards/:id/comments sans token retourne 401', async () => {
  const res = await request(app).get(`/api/cards/${cardId}/comments`);
  assert.equal(res.status, 401);
});

test('GET /api/cards/:id/comments est vide au départ', async () => {
  const res = await request(app).get(`/api/cards/${cardId}/comments`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /api/cards/:id/comments crée un commentaire avec le username', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Premier commentaire' });
  assert.equal(res.status, 201);
  assert.equal(res.body.body, 'Premier commentaire');
  assert.equal(res.body.username, 'admin');
  assert.equal(res.body.card_id, cardId);
});

test('POST /api/cards/:id/comments avec un body vide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: '   ' });
  assert.equal(res.status, 400);
});

test('POST /api/cards/:id/comments sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .post('/api/cards/9999/comments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'X' });
  assert.equal(res.status, 404);
});

test('GET /api/cards/:id/comments liste les commentaires créés, triés par date', async () => {
  await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Premier' });
  await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Deuxième' });

  const res = await request(app).get(`/api/cards/${cardId}/comments`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((c) => c.body),
    ['Premier', 'Deuxième']
  );
});

test("DELETE /api/cards/:id/comments/:commentId par l'auteur supprime le commentaire", async () => {
  const created = await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'À supprimer' });

  const res = await request(app)
    .delete(`/api/cards/${cardId}/comments/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test("DELETE par un autre utilisateur non-admin retourne 403", async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const aliceToken = await loginAs('alice', 'alice123');

  const created = await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Commentaire admin' });

  const res = await request(app)
    .delete(`/api/cards/${cardId}/comments/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 403);
});

test('DELETE par un admin sur le commentaire de quelqu\'un d\'autre fonctionne', async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const aliceToken = await loginAs('alice', 'alice123');

  const created = await request(app)
    .post(`/api/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ body: 'Commentaire alice' });

  const res = await request(app)
    .delete(`/api/cards/${cardId}/comments/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE sur un commentaire inexistant retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/cards/${cardId}/comments/9999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
