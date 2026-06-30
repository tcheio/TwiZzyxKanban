const assert = require('node:assert/strict');
const { test } = require('node:test');
const { app, request } = require('./helpers');

test('GET /api/health retourne 200', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});
