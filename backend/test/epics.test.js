const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

let adminToken;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
});

test('GET /api/epics sans token retourne 401', async () => {
  const res = await request(app).get('/api/epics');
  assert.equal(res.status, 401);
});

test('GET /api/epics retourne les 3 epics par défaut avec leurs couleurs', async () => {
  const res = await request(app).get('/api/epics').set('Authorization', `Bearer ${adminToken}`);
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

test('POST /api/epics crée une epic avec une couleur valide', async () => {
  const res = await request(app)
    .post('/api/epics')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'AutreChaine', color: 'sky' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'AutreChaine');
  assert.equal(res.body.color, 'sky');
});

test('POST /api/epics sans nom retourne 400', async () => {
  const res = await request(app).post('/api/epics').set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(res.status, 400);
});

test('POST /api/epics avec une couleur invalide retourne 400', async () => {
  const res = await request(app)
    .post('/api/epics')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'AutreChaine', color: 'not-a-color' });
  assert.equal(res.status, 400);
});

test('PATCH /api/epics/:id renomme l\'epic et change sa couleur', async () => {
  const list = await request(app).get('/api/epics').set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app)
    .patch(`/api/epics/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Renommée', color: 'emerald' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Renommée');
  assert.equal(res.body.color, 'emerald');
});

test('PATCH /api/epics/:id sur une epic inexistante retourne 404', async () => {
  const res = await request(app)
    .patch('/api/epics/9999')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE /api/epics/:id supprime une epic', async () => {
  const list = await request(app).get('/api/epics').set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app).delete(`/api/epics/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE /api/epics/:id sur une epic inexistante retourne 404', async () => {
  const res = await request(app).delete('/api/epics/9999').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET /api/epics reste autorisé pour un non-admin', async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const userToken = await loginAs('alice', 'alice123');

  const res = await request(app).get('/api/epics').set('Authorization', `Bearer ${userToken}`);
  assert.equal(res.status, 200);
});

test('POST /api/epics par un non-admin retourne 403', async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const userToken = await loginAs('alice', 'alice123');

  const res = await request(app)
    .post('/api/epics')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name: 'AutreChaine' });
  assert.equal(res.status, 403);
});

test('DELETE /api/epics/:id utilisé par une carte retire simplement l\'epic de la carte (pas de blocage)', async () => {
  const epics = await request(app).get('/api/epics').set('Authorization', `Bearer ${adminToken}`);
  const epicId = epics.body[0].id;
  const columns = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);

  const card = await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo', column_id: columns.body[0].id, epic_id: epicId });
  assert.equal(card.body.epic_id, epicId);

  const del = await request(app).delete(`/api/epics/${epicId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(del.status, 204);

  const refetched = await request(app)
    .get(`/api/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.epic_id, null);
});
