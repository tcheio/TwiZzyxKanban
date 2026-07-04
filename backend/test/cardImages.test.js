const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let adminToken;
let cardId;
let otherCardId;

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
  const other = await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Autre vidéo', column_id: columns.body[0].id });
  otherCardId = other.body.id;
});

test('GET /api/cards/:id/images sans token retourne 401', async () => {
  const res = await request(app).get(`/api/cards/${cardId}/images`);
  assert.equal(res.status, 401);
});

test('GET /api/cards/:id/images est vide au départ', async () => {
  const res = await request(app).get(`/api/cards/${cardId}/images`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /api/cards/:id/images crée une image', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });
  assert.equal(res.status, 201);
  assert.equal(res.body.card_id, cardId);
  assert.equal(res.body.data_url, TINY_PNG);
});

test('POST /api/cards/:id/images rejette une data_url invalide', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: 'not-an-image' });
  assert.equal(res.status, 400);
});

test('POST /api/cards/:id/images rejette une data_url manquante', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(res.status, 400);
});

test('POST /api/cards/:id/images sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .post('/api/cards/9999/images')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });
  assert.equal(res.status, 404);
});

test('GET /api/cards/:id/images liste les images créées, triées par date', async () => {
  await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });
  await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });

  const res = await request(app).get(`/api/cards/${cardId}/images`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
});

test("GET /api/cards/:id/images ne retourne pas les images d'une autre carte", async () => {
  await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });

  const res = await request(app)
    .get(`/api/cards/${otherCardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(res.body, []);
});

test('DELETE /api/cards/:id/images/:imageId supprime l\'image', async () => {
  const created = await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });

  const res = await request(app)
    .delete(`/api/cards/${cardId}/images/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const list = await request(app).get(`/api/cards/${cardId}/images`).set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(list.body, []);
});

test('DELETE sur une image inexistante retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/cards/${cardId}/images/9999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test("DELETE échoue si l'image appartient à une autre carte", async () => {
  const created = await request(app)
    .post(`/api/cards/${cardId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: TINY_PNG });

  const res = await request(app)
    .delete(`/api/cards/${otherCardId}/images/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
