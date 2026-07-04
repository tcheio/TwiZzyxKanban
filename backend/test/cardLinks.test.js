const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

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
    .send({ title: 'Vidéo A', column_id: columns.body[0].id });
  cardId = card.body.id;
  const other = await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo B', column_id: columns.body[0].id });
  otherCardId = other.body.id;
});

test('GET /api/cards/:id/links sans token retourne 401', async () => {
  const res = await request(app).get(`/api/cards/${cardId}/links`);
  assert.equal(res.status, 401);
});

test('GET /api/cards/:id/links est vide au départ', async () => {
  const res = await request(app).get(`/api/cards/${cardId}/links`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /api/cards/:id/links crée un lien', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  assert.equal(res.status, 201);
  assert.equal(res.body.card_id, cardId);
  assert.equal(res.body.linked_card_id, otherCardId);
  assert.equal(res.body.type, 'before');
});

test('POST /api/cards/:id/links avec un type invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'pendant' });
  assert.equal(res.status, 400);
});

test('POST /api/cards/:id/links vers soi-même retourne 400', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: cardId, type: 'before' });
  assert.equal(res.status, 400);
});

test('POST /api/cards/:id/links avec un linked_card_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: 9999, type: 'before' });
  assert.equal(res.status, 400);
});

test('POST /api/cards/:id/links sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .post('/api/cards/9999/links')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  assert.equal(res.status, 404);
});

test('POST /api/cards/:id/links en double retourne 400', async () => {
  await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  const res = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  assert.equal(res.status, 400);
});

test('GET /api/cards/:id/links liste le lien depuis les deux côtés', async () => {
  await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });

  const fromSource = await request(app)
    .get(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(fromSource.body.length, 1);

  const fromTarget = await request(app)
    .get(`/api/cards/${otherCardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(fromTarget.body.length, 1);
});

test('DELETE /api/cards/:id/links/:linkId supprime le lien', async () => {
  const created = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'after' });

  const res = await request(app)
    .delete(`/api/cards/${cardId}/links/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const list = await request(app).get(`/api/cards/${cardId}/links`).set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(list.body, []);
});

test('DELETE /api/cards/:id/links/:linkId est aussi possible depuis le ticket lié', async () => {
  const created = await request(app)
    .post(`/api/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });

  const res = await request(app)
    .delete(`/api/cards/${otherCardId}/links/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE sur un lien inexistant retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/cards/${cardId}/links/9999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
