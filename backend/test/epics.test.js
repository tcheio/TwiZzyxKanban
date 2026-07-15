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

test('GET /api/kanbans/:id/epics sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/epics`);
  assert.equal(res.status, 401);
});

test('GET retourne les 3 epics par défaut avec leurs couleurs', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((e) => e.name).sort(),
    ['Twitch', 'TwiZzyx', 'TwiZzyxPasSympa'].sort()
  );
  const twiZzyx = res.body.find((e) => e.name === 'TwiZzyx');
  const twiZzyxPasSympa = res.body.find((e) => e.name === 'TwiZzyxPasSympa');
  const twitch = res.body.find((e) => e.name === 'Twitch');
  assert.equal(twiZzyx.color, 'red');
  assert.equal(twiZzyxPasSympa.color, 'orange');
  assert.equal(twitch.color, 'violet');
});

test('POST crée une epic avec une couleur valide', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/epics`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'AutreChaine', color: 'sky' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'AutreChaine');
  assert.equal(res.body.color, 'sky');
});

test('POST sans nom retourne 400', async () => {
  const res = await request(app).post(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(res.status, 400);
});

test('POST avec une couleur invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/epics`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'AutreChaine', color: 'not-a-color' });
  assert.equal(res.status, 400);
});

test("PATCH renomme l'epic et change sa couleur", async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/epics/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Renommée', color: 'emerald' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Renommée');
  assert.equal(res.body.color, 'emerald');
});

test('PATCH sur une epic inexistante retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/epics/9999`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE supprime une epic', async () => {
  const list = await request(app).get(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app).delete(`/api/kanbans/${kanbanId}/epics/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE sur une epic inexistante retourne 404', async () => {
  const res = await request(app).delete(`/api/kanbans/${kanbanId}/epics/9999`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET refusé (403) pour un utilisateur non-membre du kanban', async () => {
  const { token } = await createUser('bob');
  const res = await request(app).get(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('GET autorisé pour un membre simple (non modérateur)', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app).get(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
});

test('POST par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/epics`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'AutreChaine' });
  assert.equal(res.status, 403);
});

test('POST par un modérateur (non-admin) réussit', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, true);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/epics`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'AutreChaine' });
  assert.equal(res.status, 201);
});

test("DELETE une epic utilisée par une carte retire simplement l'epic de la carte (pas de blocage)", async () => {
  const epics = await request(app).get(`/api/kanbans/${kanbanId}/epics`).set('Authorization', `Bearer ${adminToken}`);
  const epicId = epics.body[0].id;
  const columns = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo', column_id: columns.body[0].id, epic_id: epicId });
  assert.equal(card.body.epic_id, epicId);

  const del = await request(app).delete(`/api/kanbans/${kanbanId}/epics/${epicId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(del.status, 204);

  const refetched = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.epic_id, null);
});
