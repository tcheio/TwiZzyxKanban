const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

let adminToken;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
});

test('GET /api/tags sans token retourne 401', async () => {
  const res = await request(app).get('/api/tags');
  assert.equal(res.status, 401);
});

test('GET /api/tags retourne les 4 tags par défaut triés par nom', async () => {
  const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((t) => t.name).sort(),
    ['Inazuma Eleven', 'Minecraft', 'Pokémon', 'Ykw Watch'].sort()
  );
});

test('POST /api/tags crée un tag', async () => {
  const res = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'One Piece' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'One Piece');
});

test('POST /api/tags sans nom retourne 400', async () => {
  const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(res.status, 400);
});

test('PATCH /api/tags/:id renomme le tag', async () => {
  const list = await request(app).get('/api/tags').set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app)
    .patch(`/api/tags/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Renommé' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Renommé');
});

test('PATCH /api/tags/:id sur un tag inexistant retourne 404', async () => {
  const res = await request(app)
    .patch('/api/tags/9999')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE /api/tags/:id supprime un tag', async () => {
  const list = await request(app).get('/api/tags').set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app).delete(`/api/tags/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE /api/tags/:id sur un tag inexistant retourne 404', async () => {
  const res = await request(app).delete('/api/tags/9999').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('DELETE /api/tags/:id utilisé par une carte retire simplement le tag de la carte (pas de blocage)', async () => {
  const tags = await request(app).get('/api/tags').set('Authorization', `Bearer ${adminToken}`);
  const tagId = tags.body[0].id;
  const columns = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);

  const card = await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo', column_id: columns.body[0].id, tag_id: tagId });
  assert.equal(card.body.tag_id, tagId);

  const del = await request(app).delete(`/api/tags/${tagId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(del.status, 204);

  const refetched = await request(app)
    .get(`/api/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.tag_id, null);
});
