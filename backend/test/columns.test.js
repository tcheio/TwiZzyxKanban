const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

let adminToken;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
});

test('GET /api/columns sans token retourne 401', async () => {
  const res = await request(app).get('/api/columns');
  assert.equal(res.status, 401);
});

test('GET /api/columns retourne les 6 colonnes par défaut triées par position', async () => {
  const res = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((c) => c.name),
    ['Idée', 'Préparation/Écriture', 'Tournage', 'Montage', 'Miniature', 'Publié']
  );
});

test('POST /api/columns crée une colonne en fin de liste', async () => {
  const res = await request(app)
    .post('/api/columns')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Archivé' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Archivé');
  assert.equal(res.body.position, 6);
});

test('POST /api/columns sans nom retourne 400', async () => {
  const res = await request(app).post('/api/columns').set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(res.status, 400);
});

test('PATCH /api/columns/:id renomme la colonne', async () => {
  const list = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[0].id;
  const res = await request(app)
    .patch(`/api/columns/${id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Brouillon' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Brouillon');
});

test('PATCH /api/columns/:id sur une colonne inexistante retourne 404', async () => {
  const res = await request(app)
    .patch('/api/columns/9999')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'X' });
  assert.equal(res.status, 404);
});

test('DELETE /api/columns/:id supprime une colonne vide', async () => {
  const list = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);
  const id = list.body[4].id;
  const res = await request(app).delete(`/api/columns/${id}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE /api/columns/:id refuse si la colonne contient des cartes (409)', async () => {
  const list = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);
  const columnId = list.body[0].id;
  await request(app)
    .post('/api/cards')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Carte', column_id: columnId });

  const res = await request(app).delete(`/api/columns/${columnId}`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
});

test('DELETE /api/columns/:id sur une colonne inexistante retourne 404', async () => {
  const res = await request(app).delete('/api/columns/9999').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('PATCH /api/columns/reorder réordonne les colonnes', async () => {
  const list = await request(app).get('/api/columns').set('Authorization', `Bearer ${adminToken}`);
  const ids = list.body.map((c) => c.id);
  const reversed = [...ids].reverse();

  const res = await request(app)
    .patch('/api/columns/reorder')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ orderedIds: reversed });
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.map((c) => c.id),
    reversed
  );
});

test('PATCH /api/columns/reorder sans orderedIds retourne 400', async () => {
  const res = await request(app)
    .patch('/api/columns/reorder')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert.equal(res.status, 400);
});
