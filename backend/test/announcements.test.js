const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let otherKanbanId;
let aliceToken;

async function createUser(username, role = 'user') {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: `${username}123`, role });
  return { id: res.body.id, token: await loginAs(username, `${username}123`) };
}

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  kanbanId = (await createKanban(adminToken, { name: 'Kanban A', code: 'TK-A' })).kanban.id;
  otherKanbanId = (await createKanban(adminToken, { name: 'Kanban B', code: 'TK-B' })).kanban.id;

  const alice = await createUser('alice');
  aliceToken = alice.token;
  await addMember(adminToken, kanbanId, alice.id, false);
});

test('GET /api/announcements sans token retourne 401', async () => {
  const res = await request(app).get('/api/announcements');
  assert.equal(res.status, 401);
});

test('POST réservé aux admins', async () => {
  const res = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ message: 'Maintenance prévue' });
  assert.equal(res.status, 403);
});

test('POST sans message retourne 400', async () => {
  const res = await request(app).post('/api/announcements').set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(res.status, 400);
});

test('POST avec un kanban_id invalide retourne 400', async () => {
  const res = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Test', kanban_id: 9999 });
  assert.equal(res.status, 400);
});

test('POST crée une annonce globale (sans kanban_id)', async () => {
  const res = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Maintenance prévue ce soir' });
  assert.equal(res.status, 201);
  assert.equal(res.body.kanban_id, null);
  assert.equal(res.body.message, 'Maintenance prévue ce soir');
});

test('POST crée une annonce scopée à un kanban', async () => {
  const res = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Ce kanban va être archivé', kanban_id: kanbanId });
  assert.equal(res.status, 201);
  assert.equal(res.body.kanban_id, kanbanId);
  assert.equal(res.body.kanban_code, 'TK-A');
});

test('un utilisateur voit les annonces globales et celles de ses kanbans, pas celles des autres', async () => {
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Pour A', kanban_id: kanbanId });
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Pour B', kanban_id: otherKanbanId });

  const res = await request(app).get('/api/announcements').set('Authorization', `Bearer ${aliceToken}`);
  const messages = res.body.map((a) => a.message).sort();
  assert.deepEqual(messages, ['Globale', 'Pour A']);
});

test('un admin voit toutes les annonces', async () => {
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Pour B', kanban_id: otherKanbanId });

  const res = await request(app).get('/api/announcements').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.body.length, 2);
});

test("PATCH modifie le message et/ou le champ d'application", async () => {
  const created = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });

  const res = await request(app)
    .patch(`/api/announcements/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Modifiée', kanban_id: kanbanId });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Modifiée');
  assert.equal(res.body.kanban_id, kanbanId);
});

test('PATCH réservé aux admins', async () => {
  const created = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });

  const res = await request(app)
    .patch(`/api/announcements/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ message: 'Modifiée' });
  assert.equal(res.status, 403);
});

test('PATCH sur une annonce inexistante retourne 404', async () => {
  const res = await request(app)
    .patch('/api/announcements/9999')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE supprime une annonce', async () => {
  const created = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });

  const res = await request(app)
    .delete(`/api/announcements/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);

  const list = await request(app).get('/api/announcements').set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(list.body, []);
});

test('DELETE réservé aux admins', async () => {
  const created = await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });

  const res = await request(app)
    .delete(`/api/announcements/${created.body.id}`)
    .set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 403);
});

test('la suppression du kanban supprime aussi ses annonces (globales conservées)', async () => {
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Globale' });
  await request(app)
    .post('/api/announcements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Pour A', kanban_id: kanbanId });

  await request(app).delete(`/api/kanbans/${kanbanId}`).set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app).get('/api/announcements').set('Authorization', `Bearer ${adminToken}`);
  assert.deepEqual(res.body.map((a) => a.message), ['Globale']);
});
