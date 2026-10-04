const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');

let adminToken;
let kanbanId;
let columns;
let tagIds;
let cardId;
let aliceId;
let aliceToken;
let bobId;

async function createUser(username, role = 'user') {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: `${username}123`, role });
  const token = await loginAs(username, `${username}123`);
  return { id: res.body.id, token };
}

async function notificationsFor(token) {
  const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
  return res.body;
}

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'video' });
  kanbanId = created.kanban.id;
  columns = created.columns;

  const tags = await request(app).get(`/api/kanbans/${kanbanId}/tags`).set('Authorization', `Bearer ${adminToken}`);
  tagIds = tags.body.map((t) => t.id);

  const alice = await createUser('alice');
  aliceId = alice.id;
  aliceToken = alice.token;
  await addMember(adminToken, kanbanId, aliceId, false);

  const bob = await createUser('bob');
  bobId = bob.id;
  await addMember(adminToken, kanbanId, bobId, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Vidéo A', column_id: columns[0].id, assigned_user_id: aliceId });
  cardId = card.body.id;
});

test('GET /api/notifications sans token retourne 401', async () => {
  const res = await request(app).get('/api/notifications');
  assert.equal(res.status, 401);
});

test("l'ajout d'un tag notifie les responsables du ticket, pas l'auteur de l'action", async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[0] });

  const aliceNotifs = await notificationsFor(aliceToken);
  assert.equal(aliceNotifs.length, 1);
  assert.equal(aliceNotifs[0].type, 'tag');
  assert.equal(aliceNotifs[0].card_id, cardId);

  const adminNotifs = await notificationsFor(adminToken);
  assert.equal(adminNotifs.length, 0);
});

test("l'ajout d'un responsable notifie la personne ajoutée et les responsables existants", async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: bobId, reason: 'Renfort' });

  const bobNotifs = await notificationsFor(await loginAs('bob', 'bob123'));
  assert.equal(bobNotifs.length, 1);
  assert.match(bobNotifs[0].message, /ajouté.*responsable/);

  const aliceNotifs = await notificationsFor(aliceToken);
  assert.equal(aliceNotifs.length, 1);
  assert.equal(aliceNotifs[0].type, 'assignee');
});

test('le retrait d\'un responsable notifie la personne retirée avec la raison', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: bobId, reason: 'Renfort' });

  const bobToken = await loginAs('bob', 'bob123');

  await request(app)
    .delete(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees/${bobId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Ticket réassigné en interne' });

  const bobNotifs = await notificationsFor(bobToken);
  const removalNotif = bobNotifs.find((n) => n.message.includes('retiré'));
  assert.ok(removalNotif);
  assert.match(removalNotif.message, /Raison : Ticket réassigné en interne/);
});

test('un nouveau commentaire notifie les responsables mais pas son auteur', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Un commentaire' });

  const aliceNotifs = await notificationsFor(aliceToken);
  assert.equal(aliceNotifs.length, 1);
  assert.equal(aliceNotifs[0].type, 'comment');

  const adminNotifs = await notificationsFor(adminToken);
  assert.equal(adminNotifs.length, 0);
});

test('un changement de colonne notifie les responsables', async () => {
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${cardId}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: columns[1].id });

  const aliceNotifs = await notificationsFor(aliceToken);
  assert.equal(aliceNotifs.length, 1);
  assert.equal(aliceNotifs[0].type, 'status');
});

test('annuler un ticket notifie les responsables', async () => {
  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${cardId}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);

  const aliceNotifs = await notificationsFor(aliceToken);
  assert.equal(aliceNotifs.length, 1);
  assert.match(aliceNotifs[0].message, /annulé/);
});

test('PATCH /api/notifications/:id/read marque comme lue', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Un commentaire' });

  const [notif] = await notificationsFor(aliceToken);
  assert.equal(notif.read_at, null);

  const res = await request(app)
    .patch(`/api/notifications/${notif.id}/read`)
    .set('Authorization', `Bearer ${aliceToken}`);
  assert.equal(res.status, 204);

  const [reloaded] = await notificationsFor(aliceToken);
  assert.ok(reloaded.read_at);
});

test("PATCH /api/notifications/:id/read refuse de marquer la notification d'un autre utilisateur", async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Un commentaire' });

  const [notif] = await notificationsFor(aliceToken);
  const bobToken = await loginAs('bob', 'bob123');

  const res = await request(app).patch(`/api/notifications/${notif.id}/read`).set('Authorization', `Bearer ${bobToken}`);
  assert.equal(res.status, 404);
});

test('POST /api/notifications/read-all marque toutes les notifications comme lues', async () => {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tag_id: tagIds[0] });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ body: 'Un commentaire' });

  await request(app).post('/api/notifications/read-all').set('Authorization', `Bearer ${aliceToken}`);

  const notifs = await notificationsFor(aliceToken);
  assert.equal(notifs.length, 2);
  assert.ok(notifs.every((n) => n.read_at));
});
