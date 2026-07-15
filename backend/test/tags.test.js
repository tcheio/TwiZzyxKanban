const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;

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
  ({
    kanban: { id: kanbanId },
  } = await createKanban(adminToken, { template: 'video' }));
});

test('GET /api/kanbans/:id/tags sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/tags`);
  assert.equal(res.status, 401);
});

test('GET retourne les 4 tags par défaut triés par nom', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((t) => t.name).sort(),
    ['Inazuma Eleven', 'Minecraft', 'Pokémon', 'Ykw Watch'].sort()
  );
});

test('POST crée un tag', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'One Piece' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'One Piece');
});

test('POST sans nom retourne 400', async () => {
  const res = await request(app).post(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(res.status, 400);
});

test('PATCH renomme le tag', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/tags/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Renommé' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Renommé');
});

test('PATCH sur un tag inexistant retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/tags/9999`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE supprime un tag', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app).delete(`/api/kanbans/${kanbanId}/tags/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE sur un tag inexistant retourne 404', async () => {
  const res = await request(app).delete(`/api/kanbans/${kanbanId}/tags/9999`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET refusé (403) pour un utilisateur non-membre du kanban', async () => {
  const { token } = await createUser('bob');
  const res = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('GET autorisé pour un membre simple (non modérateur)', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
});

test('POST par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/tags`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'One Piece' });
  assert.equal(res.status, 403);
});

test('PATCH par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const list = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/tags/${list.body[0].id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Renommé' });
  assert.equal(res.status, 403);
});

test('DELETE par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const list = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/tags/${list.body[0].id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('POST par un modérateur (non-admin) réussit', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, true);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/tags`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'One Piece' });
  assert.equal(res.status, 201);
});

test('DELETE un tag utilisé par une carte retire simplement le tag de la carte (pas de blocage)', async () => {
  const tags = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);
  const tagId = tags.body[0].id;
  const columns = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo', column_id: columns.body[0].id, tag_id: tagId });
  assert.equal(card.body.tag_id, tagId);

  const del = await request(app).delete(`/api/kanbans/${kanbanId}/tags/${tagId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(del.status, 204);

  const refetched = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.tag_id, null);
});
