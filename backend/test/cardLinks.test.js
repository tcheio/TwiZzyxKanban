const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, request } = require('./helpers');

let adminToken;
let kanbanId;
let cardId;
let otherCardId;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo A', column_id: created.columns[0].id });
  cardId = card.body.id;
  const other = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo B', column_id: created.columns[0].id });
  otherCardId = other.body.id;
});

test('GET /links sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/cards/${cardId}/links`);
  assert.equal(res.status, 401);
});

test('GET /links est vide au départ', async () => {
  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /links crée un lien', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  assert.equal(res.status, 201);
  assert.equal(res.body.card_id, cardId);
  assert.equal(res.body.linked_card_id, otherCardId);
  assert.equal(res.body.type, 'before');
});

test('POST /links avec un type invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'pendant' });
  assert.equal(res.status, 400);
});

test('POST /links vers soi-même retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: cardId, type: 'before' });
  assert.equal(res.status, 400);
});

test('POST /links avec un linked_card_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: 9999, type: 'before' });
  assert.equal(res.status, 400);
});

test("POST /links avec un linked_card_id d'un autre kanban retourne 400", async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });
  const foreignCard = await request(app)
    .post(`/api/kanbans/${other.kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Étranger', column_id: other.columns[0].id });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: foreignCard.body.id, type: 'before' });
  assert.equal(res.status, 400);
});

test('POST /links sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/9999/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  assert.equal(res.status, 404);
});

test('POST /links en double retourne 400', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });
  assert.equal(res.status, 400);
});

test('GET /links liste le lien depuis les deux côtés', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });

  const fromSource = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(fromSource.body.length, 1);

  const fromTarget = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${otherCardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(fromTarget.body.length, 1);
});

test('DELETE /links/:linkId supprime le lien', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'after' });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/links/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const list = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(list.body, []);
});

test('DELETE /links/:linkId est aussi possible depuis le ticket lié', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/links`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ linked_card_id: otherCardId, type: 'before' });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${otherCardId}/links/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE sur un lien inexistant retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/links/9999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
