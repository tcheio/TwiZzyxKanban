const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let tags;
let epics;

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
  tags = created.tags;

  // Le template 'video' ne seed plus d'EPICs par défaut : ces tests en ont besoin de deux,
  // donc on les crée explicitement ici plutôt que de dépendre d'un seed implicite.
  const epicA = await request(app)
    .post(`/api/kanbans/${kanbanId}/epics`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'TwiZzyx', color: 'red' });
  const epicB = await request(app)
    .post(`/api/kanbans/${kanbanId}/epics`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'TwiZzyxPasSympa', color: 'orange' });
  epics = [epicA.body, epicB.body];
});

test('GET /api/kanbans/:id/cards sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/cards`);
  assert.equal(res.status, 401);
});

test('POST par un utilisateur non-membre retourne 403', async () => {
  const { token } = await createUser('alice');

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 403);
});

test('POST par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 403);
});

test('POST par un modérateur (non-admin) réussit', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, true);

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 201);
});

test('POST /api/kanbans/:id/cards crée une carte avec une clé {code}-{id}', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo A', priority: 'high', column_id: columns[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.title, 'Vidéo A');
  assert.equal(res.body.priority, 'high');
  assert.equal(res.body.position, 0);
  assert.equal(res.body.key, `TK-TEST-${res.body.id}`);
});

test('POST sans titre retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ column_id: columns[0].id });
  assert.equal(res.status, 400);
});

test('POST avec une colonne invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: 9999 });
  assert.equal(res.status, 400);
});

test("POST avec une colonne d'un autre kanban retourne 400", async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: other.columns[0].id });
  assert.equal(res.status, 400);
});

test('POST avec une priorité invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, priority: 'urgent' });
  assert.equal(res.status, 400);
});

test('PATCH met à jour les champs', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Y', priority: 'low' });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Y');
  assert.equal(res.body.priority, 'low');
});

test('PATCH sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/9999`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Y' });
  assert.equal(res.status, 404);
});

test('DELETE supprime la carte', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 204);
});

test('DELETE par un membre simple (non modérateur) retourne 403', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('PATCH /:id/move déplace vers une autre colonne', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: columns[1].id, position: 0 });
  assert.equal(res.status, 200);
  assert.equal(res.body.column_id, columns[1].id);
  assert.equal(res.body.position, 0);
});

test('PATCH /:id/move réordonne correctement au sein de la même colonne', async () => {
  const a = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A', column_id: columns[0].id });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B', column_id: columns[0].id });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'C', column_id: columns[0].id });

  // ordre initial : A(0) B(1) C(2) -- déplace A en position 2
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${a.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: columns[0].id, position: 2 });

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${adminToken}`);
  const ordered = list.body
    .filter((card) => card.column_id === columns[0].id)
    .sort((x, y) => x.position - y.position);
  assert.deepEqual(
    ordered.map((card) => card.title),
    ['B', 'C', 'A']
  );
});

test('PATCH /:id/move avec une colonne invalide retourne 400', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: 9999, position: 0 });
  assert.equal(res.status, 400);
});

test("PATCH /:id/move vers une colonne d'un autre kanban retourne 400", async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: other.columns[0].id, position: 0 });
  assert.equal(res.status, 400);
});

test('PATCH /:id/move sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/9999/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: columns[0].id, position: 0 });
  assert.equal(res.status, 404);
});

test('GET /:id retourne la carte', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'X');
});

test('GET /:id sur une carte inexistante retourne 404', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/cards/9999`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('GET /:id sur une carte d\'un autre kanban retourne 404', async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });
  const created = await request(app)
    .post(`/api/kanbans/${other.kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: other.columns[0].id });

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('PATCH persiste la description', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ description: 'Quelques notes de script.' });
  assert.equal(res.status, 200);
  assert.equal(res.body.description, 'Quelques notes de script.');
});

test('POST avec un tag_id persiste le tag', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, tag_id: tags[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.tag_id, tags[0].id);
});

test('POST sans tag_id le laisse à null', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.tag_id, null);
});

test('POST avec un tag_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, tag_id: 9999 });
  assert.equal(res.status, 400);
});

test("POST avec un tag_id d'un autre kanban retourne 400", async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'video' });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, tag_id: other.tags[0].id });
  assert.equal(res.status, 400);
});

test('PATCH met à jour le tag_id', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tags[1].id });
  assert.equal(res.status, 200);
  assert.equal(res.body.tag_id, tags[1].id);
});

test("POST avec un epic_id persiste l'epic", async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, epic_id: epics[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.epic_id, epics[0].id);
});

test('POST sans epic_id le laisse à null', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.epic_id, null);
});

test('POST avec un epic_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, epic_id: 9999 });
  assert.equal(res.status, 400);
});

test("PATCH met à jour l'epic_id", async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ epic_id: epics[1].id });
  assert.equal(res.status, 200);
  assert.equal(res.body.epic_id, epics[1].id);
});

test('PATCH avec un epic_id invalide retourne 400', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ epic_id: 9999 });
  assert.equal(res.status, 400);
});

test('PATCH avec un tag_id invalide retourne 400', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: 9999 });
  assert.equal(res.status, 400);
});

test('PATCH /:id/move sans position ajoute la carte en fin de colonne cible', async () => {
  const a = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A', column_id: columns[1].id });
  const b = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B', column_id: columns[1].id });
  const moving = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Moving', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${moving.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: columns[1].id });
  assert.equal(res.status, 200);
  assert.equal(res.body.column_id, columns[1].id);
  assert.equal(res.body.position, 2);

  const list = await request(app).get(`/api/kanbans/${kanbanId}/cards`).set('Authorization', `Bearer ${adminToken}`);
  const ordered = list.body
    .filter((card) => card.column_id === columns[1].id)
    .sort((x, y) => x.position - y.position);
  assert.deepEqual(
    ordered.map((card) => card.title),
    ['A', 'B', 'Moving']
  );
});

test('POST avec due_date persiste la date', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, due_date: '2026-07-15' });
  assert.equal(res.status, 201);
  assert.equal(res.body.due_date, '2026-07-15');
});

test('POST sans due_date le laisse à null', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.due_date, null);
});

test('PATCH met à jour due_date', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ due_date: '2026-08-01' });
  assert.equal(res.status, 200);
  assert.equal(res.body.due_date, '2026-08-01');
});

test('PATCH /:id/move vers la colonne Publié renseigne published_at', async () => {
  const publishedColumn = columns.find((c) => c.name === '✅Publié');
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: publishedColumn.id });
  assert.equal(res.status, 200);
  assert.equal(res.body.column_id, publishedColumn.id);
  assert.ok(res.body.published_at);
});

test('PATCH /:id/move hors de la colonne Publié retourne 400', async () => {
  const publishedColumn = columns.find((c) => c.name === '✅Publié');
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: publishedColumn.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: columns[0].id });
  assert.equal(res.status, 400);
});

test('PATCH /:id/move réordonner au sein de Publié reste autorisé', async () => {
  const publishedColumn = columns.find((c) => c.name === '✅Publié');
  const a = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A', column_id: publishedColumn.id });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B', column_id: publishedColumn.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${a.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: publishedColumn.id, position: 1 });
  assert.equal(res.status, 200);
});

test('POST avec un cloned_from_id persiste la filiation', async () => {
  const original = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Original', column_id: columns[0].id, description: 'Notes', tag_id: tags[0].id });

  const clone = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: 'COPIE - Original',
      description: 'Notes',
      column_id: columns[0].id,
      tag_id: tags[0].id,
      cloned_from_id: original.body.id,
    });
  assert.equal(clone.status, 201);
  assert.equal(clone.body.cloned_from_id, original.body.id);
});

test('POST sans cloned_from_id le laisse à null', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });
  assert.equal(res.status, 201);
  assert.equal(res.body.cloned_from_id, null);
});

test('POST avec un cloned_from_id invalide retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, cloned_from_id: 9999 });
  assert.equal(res.status, 400);
});

test("POST avec un cloned_from_id d'un autre kanban retourne 400", async () => {
  const other = await createKanban(adminToken, { name: 'Autre', code: 'TK-AUTRE', template: 'basique' });
  const original = await request(app)
    .post(`/api/kanbans/${other.kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Original', column_id: other.columns[0].id });

  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, cloned_from_id: original.body.id });
  assert.equal(res.status, 400);
});

test('POST avec une description persiste la description', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id, description: 'Une description' });
  assert.equal(res.status, 201);
  assert.equal(res.body.description, 'Une description');
});

test('PATCH /:id/cancel annule une carte', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.cancelled_at);
});

test('PATCH /:id/cancel par un membre simple fonctionne (statut ouvert à tous les membres)', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/cancel`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.cancelled_at);
});

test('PATCH /:id/cancel sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/9999/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('PATCH /:id/restore réactive une carte annulée', async () => {
  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: columns[0].id });
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/restore`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.cancelled_at, null);
});

test('PATCH /:id/restore sur une carte inexistante retourne 404', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/9999/restore`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
});

test('DELETE sur une carte source détache simplement ses clones (pas de blocage)', async () => {
  const original = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Original', column_id: columns[0].id });
  const clone = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Clone', column_id: columns[0].id, cloned_from_id: original.body.id });

  const del = await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${original.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(del.status, 204);

  const refetched = await request(app)
    .get(`/api/kanbans/${kanbanId}/cards/${clone.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.cloned_from_id, null);
});
