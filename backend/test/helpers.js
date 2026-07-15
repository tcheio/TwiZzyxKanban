process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DEFAULT_ADMIN_USERNAME = 'admin';
process.env.DEFAULT_ADMIN_PASSWORD = 'admin123';

const db = require('../src/db/connection');
const migrate = require('../src/db/migrate');
const app = require('../src/app');
const request = require('supertest');

function resetDb() {
  migrate(); // garantit que le schéma existe (CREATE TABLE IF NOT EXISTS)
  db.exec(
    `DELETE FROM comments; DELETE FROM card_links; DELETE FROM card_images; DELETE FROM cards;
     DELETE FROM epics; DELETE FROM tags; DELETE FROM columns;
     DELETE FROM kanban_members; DELETE FROM kanbans; DELETE FROM users;`
  );
  migrate(); // reseed uniquement l'admin par défaut (plus aucun kanban n'est auto-créé)
}

async function loginAs(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.token;
}

// Crée un kanban via l'API (nécessite un token admin) et renvoie ses colonnes/tags/epics
// déjà seedés par le template choisi, pour que les tests n'aient pas à recréer ces ids eux-mêmes.
async function createKanban(adminToken, { name = 'Test Kanban', code = 'TK-TEST', template = 'basique' } = {}) {
  const res = await request(app)
    .post('/api/kanbans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, code, template });
  const kanban = res.body;

  const [columns, tags, epics] = await Promise.all([
    request(app).get(`/api/kanbans/${kanban.id}/columns`).set('Authorization', `Bearer ${adminToken}`),
    request(app).get(`/api/kanbans/${kanban.id}/tags`).set('Authorization', `Bearer ${adminToken}`),
    request(app).get(`/api/kanbans/${kanban.id}/epics`).set('Authorization', `Bearer ${adminToken}`),
  ]);

  return { kanban, columns: columns.body, tags: tags.body, epics: epics.body };
}

// Ajoute un utilisateur existant comme membre (ou modérateur) d'un kanban via l'API.
async function addMember(token, kanbanId, userId, isModerator = false) {
  await request(app)
    .post(`/api/kanbans/${kanbanId}/members`)
    .set('Authorization', `Bearer ${token}`)
    .send({ user_id: userId });
  if (isModerator) {
    await request(app)
      .patch(`/api/kanbans/${kanbanId}/members/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_moderator: true });
  }
}

module.exports = { app, db, resetDb, loginAs, createKanban, addMember, request };
