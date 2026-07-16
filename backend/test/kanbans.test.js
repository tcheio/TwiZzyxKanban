const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;

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
});

test('GET /api/kanbans sans token retourne 401', async () => {
  const res = await request(app).get('/api/kanbans');
  assert.equal(res.status, 401);
});

test("POST /api/kanbans crée un kanban à partir du template 'video'", async () => {
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Chaîne Test', code: 'tk-test', template: 'video' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Chaîne Test');
  assert.equal(res.body.code, 'TK-TEST');
  assert.equal(res.body.is_moderator, true);

  const columns = await request(app)
    .get(`/api/kanbans/${res.body.id}/columns`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(
    columns.body.map((c) => c.name),
    ['💡Idées', '📝Préparation/Écriture', '🎥Tournage', '🎬Montage', '🖼️Miniature', '✅Publié']
  );
});

test("POST /api/kanbans crée un kanban à partir du template 'basique'", async () => {
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Projet simple', code: 'TK-SIMPLE', template: 'basique' });
  assert.equal(res.status, 201);

  const columns = await request(app)
    .get(`/api/kanbans/${res.body.id}/columns`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(
    columns.body.map((c) => c.name),
    ['À faire', 'En cours', 'Fait']
  );
  const tags = await request(app).get(`/api/kanbans/${res.body.id}/tags`).set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(tags.body, []);
});

test('POST /api/kanbans sans template utilise le template par défaut (video)', async () => {
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Sans template', code: 'TK-DEFAULT' });
  assert.equal(res.status, 201);
});

test('POST /api/kanbans sans name ou code retourne 400', async () => {
  const res = await request(app).post('/api/kanbans').set('Authorization', `Bearer ${adminToken}`).send({ name: 'X' });
  assert.equal(res.status, 400);
});

test('POST /api/kanbans avec un code au format invalide retourne 400', async () => {
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X', code: 'a b!' });
  assert.equal(res.status, 400);
});

test('POST /api/kanbans avec un template inconnu retourne 400', async () => {
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X', code: 'TK-X', template: 'inconnu' });
  assert.equal(res.status, 400);
});

test('POST /api/kanbans avec un code déjà utilisé retourne 409', async () => {
  await createKanban(adminToken, { code: 'TK-DUP' });
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Autre', code: 'TK-DUP' });
  assert.equal(res.status, 409);
});

test('POST /api/kanbans par un non-admin retourne 403', async () => {
  const { token } = await createUser('alice');
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'X', code: 'TK-X' });
  assert.equal(res.status, 403);
});

test('GET /api/kanbans retourne tous les kanbans pour un admin', async () => {
  await createKanban(adminToken, { code: 'TK-A' });
  await createKanban(adminToken, { code: 'TK-B' });

  const res = await request(app).get('/api/kanbans').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
});

test("GET /api/kanbans ne retourne à un utilisateur que les kanbans où il est membre", async () => {
  const { kanban: kanbanA } = await createKanban(adminToken, { code: 'TK-A' });
  await createKanban(adminToken, { code: 'TK-B' });
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanA.id, id, false);

  const res = await request(app).get('/api/kanbans').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].id, kanbanA.id);
});

test('PATCH /api/kanbans/:id renomme le kanban (admin)', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const res = await request(app)
    .patch(`/api/kanbans/${kanban.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Nouveau nom' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Nouveau nom');
});

test('PATCH /api/kanbans/:id par un modérateur (non-admin) retourne 403', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanban.id, id, true);

  const res = await request(app)
    .patch(`/api/kanbans/${kanban.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Nouveau nom' });
  assert.equal(res.status, 403);
});

test('DELETE /api/kanbans/:id supprime le kanban et cascade sur ses colonnes/cartes', async () => {
  const { kanban, columns } = await createKanban(adminToken, { code: 'TK-A', template: 'video' });
  const card = await request(app)
    .post(`/api/kanbans/${kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(card.status, 201);

  const res = await request(app).delete(`/api/kanbans/${kanban.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const getColumns = await request(app)
    .get(`/api/kanbans/${kanban.id}/columns`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(getColumns.status, 404);
});

test('DELETE /api/kanbans/:id par un modérateur (non-admin) retourne 403', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanban.id, id, true);

  const res = await request(app).delete(`/api/kanbans/${kanban.id}`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('GET /api/kanbans/:id/members liste les membres', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id } = await createUser('alice');
  await addMember(adminToken, kanban.id, id, false);

  const res = await request(app)
    .get(`/api/kanbans/${kanban.id}/members`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].username, 'alice');
  assert.equal(res.body[0].is_moderator, false);
});

test('POST /api/kanbans/:id/members ajoute un membre simple', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id } = await createUser('alice');

  const res = await request(app)
    .post(`/api/kanbans/${kanban.id}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ user_id: id });
  assert.equal(res.status, 201);
  assert.equal(res.body.is_moderator, false);
});

test('POST /api/kanbans/:id/members par un modérateur (non-admin) réussit', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id: modId, token: modToken } = await createUser('mod');
  await addMember(adminToken, kanban.id, modId, true);
  const { id: aliceId } = await createUser('alice');

  const res = await request(app)
    .post(`/api/kanbans/${kanban.id}/members`)
    .set('Authorization', `Bearer ${modToken}`)
    .send({ user_id: aliceId });
  assert.equal(res.status, 201);
});

test('POST /api/kanbans/:id/members par un membre simple retourne 403', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id: memberId, token: memberToken } = await createUser('bob');
  await addMember(adminToken, kanban.id, memberId, false);
  const { id: aliceId } = await createUser('alice');

  const res = await request(app)
    .post(`/api/kanbans/${kanban.id}/members`)
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ user_id: aliceId });
  assert.equal(res.status, 403);
});

test('POST /api/kanbans/:id/members en double retourne 409', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id } = await createUser('alice');
  await addMember(adminToken, kanban.id, id, false);

  const res = await request(app)
    .post(`/api/kanbans/${kanban.id}/members`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ user_id: id });
  assert.equal(res.status, 409);
});

test('PATCH /api/kanbans/:id/members/:userId promeut un membre modérateur (admin uniquement)', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id } = await createUser('alice');
  await addMember(adminToken, kanban.id, id, false);

  const res = await request(app)
    .patch(`/api/kanbans/${kanban.id}/members/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ is_moderator: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.is_moderator, true);
});

test('PATCH /api/kanbans/:id/members/:userId par un modérateur (non-admin) retourne 403', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id: modId, token: modToken } = await createUser('mod');
  await addMember(adminToken, kanban.id, modId, true);
  const { id: aliceId } = await createUser('alice');
  await addMember(adminToken, kanban.id, aliceId, false);

  const res = await request(app)
    .patch(`/api/kanbans/${kanban.id}/members/${aliceId}`)
    .set('Authorization', `Bearer ${modToken}`)
    .send({ is_moderator: true });
  assert.equal(res.status, 403);
});

test('DELETE /api/kanbans/:id/members/:userId par un modérateur retire un membre simple', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id: modId, token: modToken } = await createUser('mod');
  await addMember(adminToken, kanban.id, modId, true);
  const { id: aliceId } = await createUser('alice');
  await addMember(adminToken, kanban.id, aliceId, false);

  const res = await request(app)
    .delete(`/api/kanbans/${kanban.id}/members/${aliceId}`)
    .set('Authorization', `Bearer ${modToken}`);
  assert.equal(res.status, 204);
});

test('DELETE /api/kanbans/:id/members/:userId par un modérateur sur un autre modérateur retourne 403', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id: mod1Id, token: mod1Token } = await createUser('mod1');
  await addMember(adminToken, kanban.id, mod1Id, true);
  const { id: mod2Id } = await createUser('mod2');
  await addMember(adminToken, kanban.id, mod2Id, true);

  const res = await request(app)
    .delete(`/api/kanbans/${kanban.id}/members/${mod2Id}`)
    .set('Authorization', `Bearer ${mod1Token}`);
  assert.equal(res.status, 403);
});

test('DELETE /api/kanbans/:id/members/:userId par un admin sur un modérateur fonctionne', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id } = await createUser('mod');
  await addMember(adminToken, kanban.id, id, true);

  const res = await request(app)
    .delete(`/api/kanbans/${kanban.id}/members/${id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('GET /api/kanbans/:id/members/lite ne renvoie que les membres (pour le picker "assigné à")', async () => {
  const { kanban } = await createKanban(adminToken, { code: 'TK-A' });
  const { id } = await createUser('alice');
  await addMember(adminToken, kanban.id, id, false);
  await createUser('bob'); // pas membre

  const res = await request(app)
    .get(`/api/kanbans/${kanban.id}/members/lite`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((u) => u.username),
    ['alice']
  );
});
