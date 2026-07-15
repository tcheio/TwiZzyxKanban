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

async function createCard(token, kanbanId, columnId, title) {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title, column_id: columnId });
  return res.body;
}

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
});

test('GET /api/search/tickets sans token retourne 401', async () => {
  const res = await request(app).get('/api/search/tickets?q=abc');
  assert.equal(res.status, 401);
});

test('GET /api/search/tickets avec une requête de moins de 2 caractères retourne []', async () => {
  const res = await request(app)
    .get('/api/search/tickets?q=a')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /api/search/tickets sans query retourne []', async () => {
  const res = await request(app).get('/api/search/tickets').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('un admin retrouve un ticket dans un kanban dont il n\'est pas membre', async () => {
  const { kanban, columns } = await createKanban(adminToken, { name: 'Projet A', code: 'TK-A' });
  await createCard(adminToken, kanban.id, columns[0].id, 'Corriger le bug de connexion');

  const res = await request(app)
    .get('/api/search/tickets?q=connexion')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, 'Corriger le bug de connexion');
  assert.equal(res.body[0].key, `TK-A-${res.body[0].id}`);
  assert.equal(res.body[0].kanban_code, 'TK-A');
});

test('un membre ne retrouve que les tickets des kanbans dont il est membre', async () => {
  const alice = await createUser('alice');
  const { kanban: kanbanA, columns: columnsA } = await createKanban(adminToken, { name: 'Projet A', code: 'TK-A' });
  const { kanban: kanbanB, columns: columnsB } = await createKanban(adminToken, { name: 'Projet B', code: 'TK-B' });
  await addMember(adminToken, kanbanA.id, alice.id);
  await createCard(adminToken, kanbanA.id, columnsA[0].id, 'Ticket visible pour Alice');
  await createCard(adminToken, kanbanB.id, columnsB[0].id, 'Ticket invisible pour Alice');

  const res = await request(app)
    .get('/api/search/tickets?q=Ticket')
    .set('Authorization', `Bearer ${alice.token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, 'Ticket visible pour Alice');
  assert.equal(res.body[0].kanban_code, 'TK-A');
});

test('un utilisateur sans aucun kanban ne retrouve rien', async () => {
  const bob = await createUser('bob');
  const { kanban, columns } = await createKanban(adminToken, { name: 'Projet A', code: 'TK-A' });
  await createCard(adminToken, kanban.id, columns[0].id, 'Ticket quelconque');

  const res = await request(app)
    .get('/api/search/tickets?q=Ticket')
    .set('Authorization', `Bearer ${bob.token}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('la recherche est insensible à la casse et sous-chaîne', async () => {
  const { kanban, columns } = await createKanban(adminToken, { name: 'Projet A', code: 'TK-A' });
  await createCard(adminToken, kanban.id, columns[0].id, 'GEOGUESSR Inazuma 3');

  const res = await request(app)
    .get('/api/search/tickets?q=geoguessr')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
});
