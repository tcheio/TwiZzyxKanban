const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, request } = require('./helpers');

before(() => resetDb());
beforeEach(() => resetDb());

test("POST /api/auth/login - identifiants valides retourne un token", async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.username, 'admin');
  assert.equal(res.body.user.role, 'admin');
});

test('POST /api/auth/login - mauvais mot de passe retourne 401', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/login - utilisateur inconnu retourne 401', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'inconnu', password: 'whatever' });
  assert.equal(res.status, 401);
});

test('POST /api/auth/login - champs manquants retourne 400', async () => {
  const res = await request(app).post('/api/auth/login').send({ password: 'admin123' });
  assert.equal(res.status, 400);
});

test('GET /api/auth/me - sans token retourne 401', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.equal(res.status, 401);
});

test("GET /api/auth/me - avec token valide retourne l'utilisateur courant", async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.username, 'admin');
  assert.equal(res.body.role, 'admin');
});

test('GET /api/auth/me - avec token invalide retourne 401', async () => {
  const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.here');
  assert.equal(res.status, 401);
});
