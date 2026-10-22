const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');
const db = require('../src/db/connection');

let adminToken;
let kanbanId;
let columns;
let tournage;
let montage;
let publie;

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
  tournage = columns.find((c) => c.name === '🎥Tournage');
  montage = columns.find((c) => c.name === '🎬Montage');
  publie = columns.find((c) => c.name === '✅Publié');
});

test('créer une carte journalise son entrée dans la colonne de départ (card_column_history)', async () => {
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: tournage.id });

  const rows = db.prepare('SELECT * FROM card_column_history WHERE card_id = ?').all(card.body.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].column_id, tournage.id);
});

test('déplacer une carte vers une autre colonne journalise la nouvelle entrée', async () => {
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: tournage.id });

  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${card.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: montage.id });

  const rows = db
    .prepare('SELECT column_id FROM card_column_history WHERE card_id = ? ORDER BY id')
    .all(card.body.id);
  assert.deepEqual(rows.map((r) => r.column_id), [tournage.id, montage.id]);
});

test('réordonner une carte au sein de la même colonne ne journalise rien de plus', async () => {
  const a = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A', column_id: tournage.id });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B', column_id: tournage.id });

  await request(app)
    .patch(`/api/kanbans/${kanbanId}/cards/${a.body.id}/move`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ columnId: tournage.id, position: 1 });

  const rows = db.prepare('SELECT * FROM card_column_history WHERE card_id = ?').all(a.body.id);
  assert.equal(rows.length, 1);
});

test('GET /stats/column-durations sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/stats/column-durations`);
  assert.equal(res.status, 401);
});

test('GET /stats/column-durations calcule la durée moyenne du séjour (uniquement les séjours terminés)', async () => {
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: tournage.id });

  // Force des dates précises pour un calcul déterministe : 48h passées dans Tournage.
  db.prepare('UPDATE card_column_history SET entered_at = ? WHERE card_id = ? AND column_id = ?').run(
    '2026-01-01T00:00:00.000Z',
    card.body.id,
    tournage.id
  );
  db.prepare('UPDATE cards SET column_id = ? WHERE id = ?').run(montage.id, card.body.id);
  db.prepare('INSERT INTO card_column_history (card_id, column_id, entered_at) VALUES (?, ?, ?)').run(
    card.body.id,
    montage.id,
    '2026-01-03T00:00:00.000Z'
  );

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/stats/column-durations`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);

  const tournageStat = res.body.find((r) => r.column_id === tournage.id);
  assert.equal(tournageStat.sample_count, 1);
  assert.equal(tournageStat.avg_hours, 48);
  // Montage n'a pas encore été quitté : pas encore de séjour terminé à mesurer.
  assert.equal(res.body.find((r) => r.column_id === montage.id), undefined);
});

test('GET /stats/column-durations filtre les séjours terminés par période (sortie dans from/to)', async () => {
  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: tournage.id });
  db.prepare('UPDATE card_column_history SET entered_at = ? WHERE card_id = ? AND column_id = ?').run(
    '2026-01-01T00:00:00.000Z',
    card.body.id,
    tournage.id
  );
  db.prepare('UPDATE cards SET column_id = ? WHERE id = ?').run(montage.id, card.body.id);
  // Sortie de Tournage hors de la période qu'on va demander (février).
  db.prepare('INSERT INTO card_column_history (card_id, column_id, entered_at) VALUES (?, ?, ?)').run(
    card.body.id,
    montage.id,
    '2026-01-03T00:00:00.000Z'
  );

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/stats/column-durations?from=2026-02-01&to=2026-02-28`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.find((r) => r.column_id === tournage.id), undefined);
});

test('GET /stats/users sans token retourne 401', async () => {
  const res = await request(app).get(`/api/kanbans/${kanbanId}/stats/users`);
  assert.equal(res.status, 401);
});

test('GET /stats/users calcule completed_count, on_time_count, avg_lead_days et current_workload par responsable', async () => {
  const { id: userId } = await createUser('alice');
  await addMember(adminToken, kanbanId, userId, false);

  // A : échéance le 10, publié le 08 → 2 jours d'avance, dans les temps.
  const a = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'A', column_id: publie.id, assigned_user_id: userId, due_date: '2026-01-10' });
  db.prepare('UPDATE cards SET published_at = ? WHERE id = ?').run('2026-01-08T10:00:00.000Z', a.body.id);

  // B : échéance le 10, publié le 12 → 2 jours de retard.
  const b = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'B', column_id: publie.id, assigned_user_id: userId, due_date: '2026-01-10' });
  db.prepare('UPDATE cards SET published_at = ? WHERE id = ?').run('2026-01-12T10:00:00.000Z', b.body.id);

  // C : toujours en cours (compte dans la charge actuelle, pas dans completed_count).
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'C', column_id: tournage.id, assigned_user_id: userId });

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/stats/users?from=2026-01-01&to=2026-01-31`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);

  const stat = res.body.find((s) => s.user_id === userId);
  assert.equal(stat.completed_count, 2);
  assert.equal(stat.with_due_date_count, 2);
  assert.equal(stat.on_time_count, 1);
  assert.equal(stat.avg_lead_days, 0);
  assert.equal(stat.current_workload, 1);
});

test('GET /stats/users inclut les responsables additionnels (card_assignees), pas seulement le principal', async () => {
  const { id: userId } = await createUser('alice');
  await addMember(adminToken, kanbanId, userId, false);

  const card = await request(app)
    .post(`/api/kanbans/${kanbanId}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'X', column_id: tournage.id });
  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${card.body.id}/assignees`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ action: 'add', user_id: userId, reason: 'Renfort' });

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/stats/users`)
    .set('Authorization', `Bearer ${adminToken}`);
  const stat = res.body.find((s) => s.user_id === userId);
  assert.equal(stat.current_workload, 1);
});

test('GET /stats/users exclut de la charge actuelle les tickets dans la dernière colonne du kanban (ex: "Fait" du template basique)', async () => {
  const basique = await createKanban(adminToken, { name: 'Basique', code: 'TK-BASIQUE', template: 'basique' });
  const { id: userId } = await createUser('alice');
  await addMember(adminToken, basique.kanban.id, userId, false);
  const fait = basique.columns.find((c) => c.name === 'Fait');
  const enCours = basique.columns.find((c) => c.name === 'En cours');

  await request(app)
    .post(`/api/kanbans/${basique.kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Fini', column_id: fait.id, assigned_user_id: userId });
  await request(app)
    .post(`/api/kanbans/${basique.kanban.id}/cards`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'En cours', column_id: enCours.id, assigned_user_id: userId });

  const res = await request(app)
    .get(`/api/kanbans/${basique.kanban.id}/stats/users`)
    .set('Authorization', `Bearer ${adminToken}`);
  const stat = res.body.find((s) => s.user_id === userId);
  assert.equal(stat.current_workload, 1);
});

test('GET /stats/users renvoie tous les membres du kanban, même sans aucun ticket', async () => {
  const { id: userId } = await createUser('bob');
  await addMember(adminToken, kanbanId, userId, false);

  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/stats/users`)
    .set('Authorization', `Bearer ${adminToken}`);
  const stat = res.body.find((s) => s.user_id === userId);
  assert.ok(stat);
  assert.equal(stat.completed_count, 0);
  assert.equal(stat.current_workload, 0);
  assert.equal(stat.avg_lead_days, null);
});

test('GET /stats/* refusé (403) pour un utilisateur non-membre du kanban', async () => {
  const { token } = await createUser('eve');
  const res = await request(app)
    .get(`/api/kanbans/${kanbanId}/stats/users`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});
