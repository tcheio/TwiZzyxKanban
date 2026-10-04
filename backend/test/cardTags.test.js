const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let cardId;
let tagIds;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  columns = created.columns;

  const tags = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);
  tagIds = tags.body.map((t) => t.id);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo A', column_id: columns[0].id, tag_id: tagIds[0] });
  cardId = card.body.id;
});

test('POST /tags sans token retourne 401', async () => {
  const res = await request(app).post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`).send({ tag_id: tagIds[1] });
  assert.equal(res.status, 401);
});

test('POST /tags ajoute un tag additionnel et le reflète dans tag_ids', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[1] });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.tag_ids, [tagIds[1]]);
  assert.equal(res.body.tag_id, tagIds[0]);
});

test('POST /tags sans tag_id retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(res.status, 400);
});

test('POST /tags avec un tag_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: 9999 });
  assert.equal(res.status, 400);
});

test('POST /tags avec le tag principal retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[0] });
  assert.equal(res.status, 400);
});

test('POST /tags en double retourne 400', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[1] });
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[1] });
  assert.equal(res.status, 400);
});

test('DELETE /tags/:tagId retire un tag additionnel', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[1] });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/tags/${tagIds[1]}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.tag_ids, []);
});

test('DELETE /tags/:tagId sur une association inexistante retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/tags/${tagIds[1]}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET /api/kanbans/:id/cards inclut tag_ids sur chaque carte', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[1] });

  const res = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${adminToken}`);
  const card = res.body.find((c) => c.id === cardId);
  assert.deepEqual(card.tag_ids, [tagIds[1]]);
});

test('la suppression du tag supprime aussi ses associations additionnelles', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[1] });

  await request(app).delete(`/api/kanbans/${kanbanId}/tags/${tagIds[1]}`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${cardId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(res.body.tag_ids, []);
});
