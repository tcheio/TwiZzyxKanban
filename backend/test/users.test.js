const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

let adminToken;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
});

test('GET /api/users sans token retourne 401', async () => {
  const res = await request(app).get('/api/users');
  assert.equal(res.status, 401);
});

test('GET /api/users avec un admin retourne la liste', async () => {
  const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].username, 'admin');
});

test('POST /api/users crée un utilisateur', async () => {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  assert.equal(res.status, 201);
  assert.equal(res.body.username, 'alice');
  assert.equal(res.body.role, 'user');
});

test('POST /api/users avec des champs manquants retourne 400', async () => {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice' });
  assert.equal(res.status, 400);
});

test('POST /api/users avec un rôle invalide retourne 400', async () => {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'superadmin' });
  assert.equal(res.status, 400);
});

test('POST /api/users avec un username déjà pris retourne 409', async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'autrepass', role: 'user' });
  assert.equal(res.status, 409);
});

test('un utilisateur non-admin reçoit 403 sur /api/users', async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const aliceToken = await loginAs('alice', 'alice123');

  const res = await request(app).get('/api/users').set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 403);
});

test('GET /api/users/lite est accessible à un utilisateur non-admin', async () => {
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });
  const aliceToken = await loginAs('alice', 'alice123');

  const res = await request(app).get('/api/users/lite').set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.ok(!('role' in res.body[0]));
});

test('PATCH /api/users/:id met à jour le rôle', async () => {
  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });

  const res = await request(app)
    .patch(`/api/users/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'admin' });
  assert.equal(res.status, 200);
  assert.equal(res.body.role, 'admin');
});

test('PATCH /api/users/:id sur un utilisateur inexistant retourne 404', async () => {
  const res = await request(app)
    .patch('/api/users/9999')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'admin' });
  assert.equal(res.status, 404);
});

test('PATCH ne peut pas rétrograder le dernier admin', async () => {
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
  const res = await request(app)
    .patch(`/api/users/${me.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'user' });
  assert.equal(res.status, 409);
});

test('DELETE /api/users/:id supprime un utilisateur', async () => {
  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });

  const res = await request(app).delete(`/api/users/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE ne peut pas supprimer son propre compte', async () => {
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
  const res = await request(app).delete(`/api/users/${me.body.id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE sur un utilisateur inexistant retourne 404', async () => {
  const res = await request(app).delete('/api/users/9999').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});
