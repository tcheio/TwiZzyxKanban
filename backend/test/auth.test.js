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

test('PATCH /api/auth/me - sans token retourne 401', async () => {
  const res = await request(app).patch('/api/auth/me').send({ username: 'newname' });
  assert.equal(res.status, 401);
});

test('PATCH /api/auth/me - renomme son propre compte', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ username: 'superadmin' });
  assert.equal(res.status, 200);
  assert.equal(res.body.username, 'superadmin');
  assert.equal(res.body.role, 'admin');
});

test('PATCH /api/auth/me - refuse un username déjà pris', async () => {
  const adminLogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminLogin.body.token}`)
    .send({ username: 'alice', password: 'alice123', role: 'user' });

  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${adminLogin.body.token}`)
    .send({ username: 'alice' });
  assert.equal(res.status, 409);
});

test('PATCH /api/auth/me - change le mot de passe avec le mot de passe actuel correct', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ currentPassword: 'admin123', password: 'newpassword123' });
  assert.equal(res.status, 200);

  const relogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'newpassword123' });
  assert.equal(relogin.status, 200);
});

test('PATCH /api/auth/me - refuse un changement de mot de passe sans mot de passe actuel', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ password: 'newpassword123' });
  assert.equal(res.status, 401);
});

test('PATCH /api/auth/me - refuse un mot de passe actuel incorrect', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ currentPassword: 'wrong', password: 'newpassword123' });
  assert.equal(res.status, 401);
});

test('PATCH /api/auth/me - refuse un nouveau mot de passe trop court', async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ currentPassword: 'admin123', password: 'abc' });
  assert.equal(res.status, 400);
});

test("PATCH /api/auth/me - met à jour la photo de profil", async () => {
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const res = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${loginRes.body.token}`)
    .send({ avatar_url: dataUrl });
  assert.equal(res.status, 200);
  assert.equal(res.body.avatar_url, dataUrl);

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.token}`);
  assert.equal(me.body.avatar_url, dataUrl);
});
