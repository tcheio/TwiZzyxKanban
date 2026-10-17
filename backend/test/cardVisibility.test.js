const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let ideaColumn;
let otherColumn;

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
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  columns = created.columns;
  ideaColumn = columns.find((c) => c.name === '💡Idées');
  otherColumn = columns.find((c) => c.name !== '💡Idées');
});

test("le template 'video' marque la colonne Idées comme restreinte et les autres non", async () => {
  assert.equal(ideaColumn.restricted, true);
  assert.equal(otherColumn.restricted, false);
});

test("le template 'basique' ne restreint aucune colonne", async () => {
  const { columns: basiqueColumns } = await createKanban(adminToken, {
    name: 'Basique',
    code: 'TK-BASIQUE',
    template: 'basique',
  });
  assert.ok(basiqueColumns.every((c) => c.restricted === false));
});

test('un membre simple (non modérateur, non assigné) ne voit pas une carte de la colonne Idées', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Idée secrète', column_id: ideaColumn.id });

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.ok(!list.body.some((c) => c.id === card.body.id));

  const getOne = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(getOne.status, 404);
});

test('un membre simple voit toujours les cartes des colonnes non restreintes', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Visible de tous', column_id: otherColumn.id });

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${token}`);
  assert.ok(list.body.some((c) => c.id === card.body.id));
});

test('le responsable principal assigné voit sa carte dans la colonne Idées', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Idée pour Alice', column_id: ideaColumn.id, assigned_user_id: id });

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${token}`);
  assert.ok(list.body.some((c) => c.id === card.body.id));

  const getOne = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(getOne.status, 200);
});

test('un responsable additionnel (card_assignees) voit la carte dans la colonne Idées', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Idée partagée', column_id: ideaColumn.id });

  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${card.body.id}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: id, reason: 'Renfort' });

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${token}`);
  assert.ok(list.body.some((c) => c.id === card.body.id));
});

test('un modérateur (non-admin) voit toutes les cartes y compris celles de la colonne Idées', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, true);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Idée modérée', column_id: ideaColumn.id });

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${token}`);
  assert.ok(list.body.some((c) => c.id === card.body.id));

  const getOne = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${card.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(getOne.status, 200);
});

test('un modérateur peut retirer la restriction sur une colonne via PATCH', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Idée devenue publique', column_id: ideaColumn.id });

  const patch = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${ideaColumn.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ restricted: false });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.restricted, false);

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${token}`);
  assert.ok(list.body.some((c) => c.id === card.body.id));
});
