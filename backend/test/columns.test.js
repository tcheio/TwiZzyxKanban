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

test('GET /api/kanbans/:id/columns sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/columns`);
  assert.equal(res.status, 401);
});

test('GET /api/kanbans/:id/columns retourne les 6 colonnes par défaut triées par position', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((c) => c.name),
    ['💡Idées', '📝Préparation/Écriture', '🎥Tournage', '🎬Montage', '🖼️Miniature', '✅Publié']
  );
});

test('POST /api/kanbans/:id/columns crée une colonne en fin de liste', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Archivé' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Archivé');
  assert.equal(res.body.position, 6);
});

test('POST /api/kanbans/:id/columns sans nom retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(res.status, 400);
});

test('PATCH /api/kanbans/:id/columns/:id renomme la colonne', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Brouillon' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Brouillon');
});

test('PATCH sur une colonne inexistante retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/9999`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE supprime une colonne vide', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[4].id;
  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/columns/${id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE refuse si la colonne contient des cartes (409)', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  const columnId = list.body[0].id;
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Carte', column_id: columnId });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/columns/${columnId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE sur une colonne inexistante retourne 404', async () => {
  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/columns/9999`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('PATCH /reorder réordonne les colonnes', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  const ids = list.body.map((c) => c.id);
  const reversed = [...ids].reverse();

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/reorder`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ orderedIds: reversed });
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((c) => c.id),
    reversed
  );
});

test('PATCH /reorder sans orderedIds retourne 400', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/reorder`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(res.status, 400);
});

test('PATCH /reorder avec des ids étrangers à ce kanban retourne 400', async () => {
  const { kanban: otherKanban } = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });
  const otherColumns = await request(app)
    .get(`/api/kanbans/${otherKanban.id}/columns`)
    .set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/reorder`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ orderedIds: otherColumns.body.map((c) => c.id) });
  assert.equal(res.status, 400);
});

test('GET refusé (403) pour un utilisateur non-membre du kanban', async () => {
  const { token } = await createUser('bob');
  const res = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('GET autorisé pour un membre simple (non modérateur)', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
});

test('POST par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Archivé' });
  assert.equal(res.status, 403);
});

test('PATCH par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${list.body[0].id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Renommé' });
  assert.equal(res.status, 403);
});

test('DELETE par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/columns/${list.body[0].id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('PATCH /reorder par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const list = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/reorder`)
    .set('Authorization', `Bearer ${token}`)
    .send({ orderedIds: [...list.body.map((c) => c.id)].reverse() });
  assert.equal(res.status, 403);
});

test('POST par un modérateur (non-admin) réussit', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, true);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Archivé' });
  assert.equal(res.status, 201);
});
