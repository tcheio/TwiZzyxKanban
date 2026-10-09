const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let montage;
let preparation;

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
  const created = await createKanban(adminToken, { template: 'video_derush' });
  kanbanId = created.kanban.id;
  columns = created.columns;
  montage = columns.find((c) => c.name === '🎬Montage');
  preparation = columns.find((c) => c.name === '📝Préparation/Écriture');
});

test("le template 'video_derush' divise la colonne Montage en Derush/Montage", async () => {
  assert.equal(montage.state_a_name, 'Derush');
  assert.equal(montage.state_b_name, 'Montage');
});

test("le template 'video_derush' ne divise aucune autre colonne", async () => {
  assert.equal(preparation.state_a_name, null);
  assert.equal(preparation.state_b_name, null);
});

test('POST /columns avec un seul des deux noms d\'état retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Nouvelle', state_a_name: 'A' });
  assert.equal(res.status, 400);
});

test('POST /columns avec les deux noms crée une colonne divisée', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Nouvelle', state_a_name: 'A', state_b_name: 'B' });
  assert.equal(res.status, 201);
  assert.equal(res.body.state_a_name, 'A');
  assert.equal(res.body.state_b_name, 'B');
});

test('PATCH /columns/:id active la division et bascule les cartes existantes en état A', async () => {
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: preparation.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${preparation.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ state_a_name: 'Brouillon', state_b_name: 'Relu' });
  assert.equal(res.status, 200);

  const refetched = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.state, 'a');
});

test('PATCH /columns/:id désactive la division et efface state sur les cartes', async () => {
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id });
  assert.equal(card.body.state, 'a');

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${montage.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ state_a_name: null, state_b_name: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.state_a_name, null);

  const refetched = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.state, null);
});

test("POST /cards dans une colonne divisée sans 'state' prend l'état A par défaut", async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id });
  assert.equal(res.status, 201);
  assert.equal(res.body.state, 'a');
});

test("POST /cards dans une colonne divisée avec state: 'b' le respecte", async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id, state: 'b' });
  assert.equal(res.status, 201);
  assert.equal(res.body.state, 'b');
});

test('POST /cards dans une colonne non divisée ignore state', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: preparation.id, state: 'a' });
  assert.equal(res.status, 201);
  assert.equal(res.body.state, null);
});

test('POST /cards avec un state invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id, state: 'c' });
  assert.equal(res.status, 400);
});

test('PATCH /:id/move change l\'état au sein de la même colonne', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id });
  assert.equal(created.body.state, 'a');

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: montage.id, state: 'b' });
  assert.equal(res.status, 200);
  assert.equal(res.body.state, 'b');
  assert.equal(res.body.column_id, montage.id);
});

test('PATCH /:id/move avec un state invalide retourne 400', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: montage.id, state: 'z' });
  assert.equal(res.status, 400);
});

test('PATCH /:id/move vers une colonne non divisée efface state', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: preparation.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.state, null);
});

test('le partitionnement des positions par état ne mélange pas Derush et Montage', async () => {
  const a1 = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A1', column_id: montage.id, state: 'a' });
  const a2 = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A2', column_id: montage.id, state: 'a' });
  const b1 = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B1', column_id: montage.id, state: 'b' });

  // A1 et A2 doivent être en position 0/1 dans l'état 'a', indépendamment de B1.
  assert.equal(a1.body.position, 0);
  assert.equal(a2.body.position, 1);
  assert.equal(b1.body.position, 0);

  // Déplacer B1 vers l'état 'a' ne doit pas décaler A1/A2 de façon incohérente.
  const moved = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${b1.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: montage.id, state: 'a' });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.position, 2);

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${adminToken}`);
  const stateA = list.body
    .filter((c) => c.column_id === montage.id && c.state === 'a')
    .sort((x, y) => x.position - y.position);
  assert.deepEqual(stateA.map((c) => c.title), ['A1', 'A2', 'B1']);
});

test('changer d\'état est réservé aux modérateurs et aux responsables du ticket', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${token}`)
    .send({ columnId: montage.id, state: 'b' });
  assert.equal(res.status, 403);
});

test('un changement d\'état par le responsable (non modérateur) notifie les modérateurs', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const mod = await createUser('mod');
  await addMember(adminToken, kanbanId, mod.id, true);

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: montage.id, assigned_user_id: id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${token}`)
    .send({ columnId: montage.id, state: 'b' });
  assert.equal(res.status, 200);

  const modNotifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${mod.token}`);
  assert.equal(modNotifs.body.length, 1);
  assert.match(modNotifs.body[0].message, /Derush.*Montage/);
});
