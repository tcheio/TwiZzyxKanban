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
  db.exec('DELETE FROM comments; DELETE FROM cards; DELETE FROM columns; DELETE FROM users;');
  migrate(); // reseed l'admin par défaut + les colonnes par défaut
}

async function loginAs(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.token;
}

module.exports = { app, db, resetDb, loginAs, request };
