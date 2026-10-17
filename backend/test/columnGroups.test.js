const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');
const db = require('../src/db/connection');
const migrate = require('../src/db/migrate');

let adminToken;
let kanbanId;
let columns;
let derush;
let montage;
let preparation;

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
  const created = await createKanban(adminToken, { template: 'video_derush' });
  kanbanId = created.kanban.id;
  columns = created.columns;
  derush = columns.find((c) => c.name === '🗃️Derush');
  montage = columns.find((c) => c.name === '🎬Montage');
  preparation = columns.find((c) => c.name === '📝Préparation/Écriture');
});

test("le template 'video_derush' crée 2 vraies colonnes imbriquées (même group_key), Derush juste avant Montage", async () => {
  assert.ok(derush);
  assert.ok(montage);
  assert.equal(derush.group_key, montage.group_key);
  assert.ok(derush.group_key);
  assert.equal(derush.position + 1, montage.position);
});

test("le template 'video_derush' ne groupe aucune autre colonne", async () => {
  assert.equal(preparation.group_key, null);
});

test('POST /columns avec group_key crée une colonne groupée', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Nouvelle', group_key: 'mon-groupe' });
  assert.equal(res.status, 201);
  assert.equal(res.body.group_key, 'mon-groupe');
});

test('POST /columns sans group_key crée une colonne non groupée (null)', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Nouvelle' });
  assert.equal(res.status, 201);
  assert.equal(res.body.group_key, null);
});

test('POST /columns avec un group_key non-string retourne 400', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/columns`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Nouvelle', group_key: 42 });
  assert.equal(res.status, 400);
});

test('PATCH /columns/:id regroupe 2 colonnes existantes (même group_key sur les deux)', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${preparation.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ group_key: 'prep-group' });
  assert.equal(res.status, 200);
  assert.equal(res.body.group_key, 'prep-group');

  const refetched = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  assert.equal(refetched.body.find((c) => c.id === preparation.id).group_key, 'prep-group');
});

test('PATCH /columns/:id avec group_key: null dégroupe la colonne', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${montage.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ group_key: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.group_key, null);

  // Derush reste groupée avec son ancienne group_key, désormais "orpheline" (seule) —
  // aucune contrainte ne l'empêche, le frontend l'affiche alors comme une colonne seule.
  const refetched = await request(app).get(`/api/kanbans/${kanbanId}/columns`).set('Authorization', `Bearer ${adminToken}`);
  assert.ok(refetched.body.find((c) => c.id === derush.id).group_key);
});

test('PATCH /columns/:id avec un group_key non-string retourne 400', async () => {
  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/columns/${montage.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ group_key: true });
  assert.equal(res.status, 400);
});

test('POST /cards fonctionne normalement dans une colonne groupée (pas de notion de state)', async () => {
  const res = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: derush.id });
  assert.equal(res.status, 201);
  assert.equal(res.body.column_id, derush.id);
  assert.equal('state' in res.body, false);
});

test('le partitionnement des positions se fait par colonne : Derush et Montage ont chacune leur propre séquence', async () => {
  const d1 = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'D1', column_id: derush.id });
  const d2 = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'D2', column_id: derush.id });
  const m1 = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'M1', column_id: montage.id });

  assert.equal(d1.body.position, 0);
  assert.equal(d2.body.position, 1);
  assert.equal(m1.body.position, 0);

  // Déplacer M1 vers Derush ne doit pas décaler D1/D2 de façon incohérente.
  const moved = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${m1.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: derush.id });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.column_id, derush.id);
  assert.equal(moved.body.position, 2);
});

test('changer de colonne au sein du groupe est réservé aux modérateurs et aux responsables du ticket', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: derush.id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${token}`)
    .send({ columnId: montage.id });
  assert.equal(res.status, 403);
});

test('déplacer un ticket vers la colonne imbriquée voisine notifie avec les vrais noms de colonnes', async () => {
  const { id, token } = await createUser('alice');
  await addMember(adminToken, kanbanId, id, false);
  const mod = await createUser('mod');
  await addMember(adminToken, kanbanId, mod.id, true);

  const created = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: derush.id, assigned_user_id: id });

  const res = await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${created.body.id}/move`)
    .set('Authorization', `Bearer ${token}`)
    .send({ columnId: montage.id });
  assert.equal(res.status, 200);

  const modNotifs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${mod.token}`);
  assert.equal(modNotifs.body.length, 1);
  assert.match(modNotifs.body[0].message, /🗃️Derush.*🎬Montage/);
});

// Migration historique : une base existante où "🎬Montage" était divisée en 2 états
// (ancien mécanisme columns.state_a_name/state_b_name + cards.state) doit, au prochain
// démarrage, voir "Derush" devenir une vraie colonne à part, imbriquée avec Montage via
// group_key, sans perdre aucune carte.
test('migrate() convertit une colonne divisée (ancien schéma) en 2 vraies colonnes imbriquées', async () => {
  // Simule une base pré-migration : on réintroduit les anciennes colonnes à la main
  // (schema.sql ne les crée plus), sur le kanban "video" (non divisé) créé ci-dessus.
  db.exec('ALTER TABLE columns ADD COLUMN state_a_name TEXT');
  db.exec('ALTER TABLE columns ADD COLUMN state_b_name TEXT');
  db.exec('ALTER TABLE cards ADD COLUMN state TEXT');

  // On simule la division sur la colonne "🗃️Derush" existante elle-même : on la renomme
  // comme avant (une seule colonne "🎬Montage" avec 2 états), pour que le test porte
  // uniquement sur le mécanisme de migration, indépendamment du template.
  db.prepare("UPDATE columns SET name = '🎬Montage', group_key = NULL WHERE id = ?").run(montage.id);
  db.prepare('DELETE FROM columns WHERE id = ?').run(derush.id);
  db.prepare(
    "UPDATE columns SET state_a_name = 'Derush', state_b_name = 'Montage' WHERE id = ?"
  ).run(montage.id);

  const cardA = db
    .prepare("INSERT INTO cards (kanban_id, title, column_id, position, state) VALUES (?, 'A', ?, 0, 'a')")
    .run(kanbanId, montage.id).lastInsertRowid;
  const cardB = db
    .prepare("INSERT INTO cards (kanban_id, title, column_id, position, state) VALUES (?, 'B', ?, 0, 'b')")
    .run(kanbanId, montage.id).lastInsertRowid;

  migrate();

  const columnsAfter = db.prepare('PRAGMA table_info(columns)').all();
  assert.equal(columnsAfter.some((c) => c.name === 'state_a_name'), false);
  const cardColumnsAfter = db.prepare('PRAGMA table_info(cards)').all();
  assert.equal(cardColumnsAfter.some((c) => c.name === 'state'), false);

  const newDerush = db.prepare("SELECT * FROM columns WHERE name = 'Derush' AND kanban_id = ?").get(kanbanId);
  const montageAfter = db.prepare('SELECT * FROM columns WHERE id = ?').get(montage.id);
  assert.ok(newDerush);
  assert.equal(newDerush.group_key, montageAfter.group_key);
  assert.ok(montageAfter.group_key);
  assert.equal(newDerush.position + 1, montageAfter.position);

  const cardAAfter = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardA);
  const cardBAfter = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardB);
  assert.equal(cardAAfter.column_id, newDerush.id);
  assert.equal(cardBAfter.column_id, montage.id);
});
