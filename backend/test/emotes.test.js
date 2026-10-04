const assert = require('node:assert/strict');
const { test, before, beforeEach } = require('node:test');
const { app, resetDb, loginAs, request } = require('./helpers');

let adminToken;

before(() => resetDb());
beforeEach(async () => {
  resetDb();
  adminToken = await loginAs('admin', 'admin123');
});

test('GET /api/emotes sans token retourne 401', async () => {
  const res = await request(app).get('/api/emotes');
  assert.equal(res.status, 401);
});

test('GET /api/emotes retourne les fichiers présents dans frontend/public/emote', async () => {
  const res = await request(app).get('/api/emotes').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.every((e) => typeof e.path === 'string' && typeof e.label === 'string'));
  assert.ok(res.body.some((e) => e.path === '/emote/PKM SVG.png'));
  assert.ok(res.body.every((e) => e.path.toLowerCase().endsWith('.png')));
});
