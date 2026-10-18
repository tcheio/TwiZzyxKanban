const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let aliceId;
let aliceToken;
let kanbanId;
let columnId;

async function createUser(username, role = 'user') {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: `${username}123`, role });
  const token = await loginAs(username, `${username}123`);
  return { id: res.body.id, token };
}

async function createCard(token, fields) {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'X', column_id: columnId, ...fields });
  return res.body;
}

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  columnId = created.columns[1].id; // colonne non restreinte

  const alice = await createUser('alice');
  aliceId = alice.id;
  aliceToken = alice.token;
  await addMember(adminToken, kanbanId, aliceId, false);
});

test('GET /api/me/tickets sans token retourne 401', async () => {
  const res = await request(app).get('/api/me/tickets');
  assert.equal(res.status, 401);
});

test('retourne les tickets dont je suis responsable principal', async () => {
  await createCard(adminToken, { title: 'Pas à moi', assigned_user_id: null });
  await createCard(adminToken, { title: 'À Alice', assigned_user_id: aliceId });

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((t) => t.title), ['À Alice']);
});

test('inclut les tickets où je suis responsable additionnel', async () => {
  const card = await createCard(adminToken, { title: 'Renfort' });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${card.id}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: aliceId, reason: 'Renfort' });

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.deepEqual(res.body.map((t) => t.title), ['Renfort']);
});

test('exclut les tickets annulés', async () => {
  const card = await createCard(adminToken, { title: 'Annulé', assigned_user_id: aliceId });
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${card.id}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.deepEqual(res.body, []);
});

test('exclut les tickets déjà publiés', async () => {
  const columns = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  const publishedColumnId = columns.body.find((c) => c.name === '✅Publié').id;
  await createCard(adminToken, { title: 'Publié', assigned_user_id: aliceId, column_id: publishedColumnId });

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.deepEqual(res.body, []);
});

test('trie par échéance croissante, sans échéance en dernier', async () => {
  await createCard(adminToken, { title: 'Sans échéance', assigned_user_id: aliceId });
  await createCard(adminToken, { title: 'Lointaine', assigned_user_id: aliceId, due_date: '2026-06-01' });
  await createCard(adminToken, { title: 'Proche', assigned_user_id: aliceId, due_date: '2026-01-10' });

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.deepEqual(res.body.map((t) => t.title), ['Proche', 'Lointaine', 'Sans échéance']);
});

test('regroupe les tickets de tous les kanbans dont je suis membre', async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });
  await addMember(adminToken, other.kanban.id, aliceId, false);
  await request(app)
    .post(`/api/kanbans/${other.kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Dans autre kanban', column_id: other.columns[0].id, assigned_user_id: aliceId });
  await createCard(adminToken, { title: 'Dans ce kanban', assigned_user_id: aliceId });

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.deepEqual(
    res.body.map((t) => t.title).sort(),
    ['Dans autre kanban', 'Dans ce kanban'].sort()
  );
  const mine = res.body.find((t) => t.title === 'Dans ce kanban');
  assert.equal(mine.kanban_code, 'TK-TEST');
  assert.equal(mine.key, `TK-TEST-${mine.id}`);
});

test("retourne une colonne et un responsable d'une colonne restreinte si j'y suis assigné", async () => {
  const columns = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  const ideaColumnId = columns.body.find((c) => c.restricted).id;
  await createCard(adminToken, { title: 'Idée restreinte', assigned_user_id: aliceId, column_id: ideaColumnId });

  const res = await request(app).get('/api/me/tickets').set('Authorization', `Bearer ${aliceToken}`);
  assert.deepEqual(res.body.map((t) => t.title), ['Idée restreinte']);
});
