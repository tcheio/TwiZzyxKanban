const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const { app, resetDb, loginAs, createKanban, addMember, request } = require('./helpers');
const discord = require('../src/utils/discord');

const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_-0123456789';
const ALICE_WEBHOOK = 'https://discord.com/api/webhooks/111111111111111111/alicealicealicealicealice_-0123456789';
const ALICE_DISCORD = '222222222222222222';
const BOB_DISCORD = '333333333333333333';

let adminToken;
let kanbanId;
let columns;
let aliceId;
let aliceToken;
let bobId;
let modToken;
let memberToken;
let sent;
let failNext;
let previousTransport;

async function createUser(username) {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: `${username}123`, role: 'user' });
  return { id: res.body.id, token: await loginAs(username, `${username}123`) };
}

function api(method, path, token = adminToken) {
  return request(app)[method](`/api/kanbans/${kanbanId}${path}`).set('Authorization', `Bearer ${token}`);
}

async function configureDiscord() {
  await api('put', '/discord/webhook').send({ webhook_url: WEBHOOK });
  await api('patch', `/discord/members/${aliceId}`).send({ discord_webhook_url: ALICE_WEBHOOK, discord_user_id: ALICE_DISCORD });
  await api('patch', `/discord/members/${bobId}`).send({ discord_user_id: BOB_DISCORD }); // pas de webhook perso
}

async function createCard(body = {}) {
  const res = await api('post', '/cards').send({ title: 'Vidéo A', column_id: columns[0].id, ...body });
  return res.body.id;
}

// Messages envoyés, indexés par destination ("main" = webhook par défaut du kanban,
// "alice" = webhook perso d'Alice).
function byDestination() {
  const names = { [WEBHOOK]: 'main', [ALICE_WEBHOOK]: 'alice' };
  return Object.fromEntries(sent.map(({ url, payload }) => [names[url] ?? url, payload]));
}

before(() => {
  resetDb();
  previousTransport = discord.setTransport(async (url, payload) => {
    if (failNext) {
      failNext = false;
      throw new Error('Discord a répondu 404');
    }
    sent.push({ url, payload });
  });
});
after(() => discord.setTransport(previousTransport));

beforeEach(async () => {
  resetDb();
  sent = [];
  failNext = false;
  adminToken = await loginAs('admin', 'admin123');
  const created = await createKanban(adminToken, { template: 'basique' });
  kanbanId = created.kanban.id;
  columns = created.columns;

  const alice = await createUser('alice');
  aliceId = alice.id;
  aliceToken = alice.token;
  await addMember(adminToken, kanbanId, aliceId, false);
  const bob = await createUser('bob');
  bobId = bob.id;
  await addMember(adminToken, kanbanId, bobId, false);
  const mod = await createUser('modo');
  await addMember(adminToken, kanbanId, mod.id, true);
  modToken = mod.token;
  memberToken = alice.token;
});

// --- Configuration ---------------------------------------------------------------

test('GET /discord est réservé aux modérateurs', async () => {
  assert.equal((await api('get', '/discord', memberToken)).status, 403);
  const res = await api('get', '/discord', modToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.webhook_configured, false);
  assert.deepEqual(
    res.body.members.map((m) => m.username),
    ['alice', 'bob', 'modo']
  );
});

test("PUT /discord/webhook refuse une URL qui n'est pas un webhook Discord", async () => {
  for (const webhook_url of ['https://example.com/api/webhooks/1/2', 'http://discord.com/api/webhooks/123456789012345678/abc', 'pas une url']) {
    const res = await api('put', '/discord/webhook').send({ webhook_url });
    assert.equal(res.status, 400, webhook_url);
  }
});

test("PUT /discord/webhook enregistre le webhook sans jamais renvoyer son jeton", async () => {
  const res = await api('put', '/discord/webhook', modToken).send({ webhook_url: WEBHOOK });
  assert.equal(res.status, 200);
  assert.equal(res.body.webhook_configured, true);
  assert.equal(res.body.webhook_url_hint, 'https://discord.com/api/webhooks/123456789012345678/••••••');

  const settings = await api('get', '/discord', modToken);
  assert.ok(!JSON.stringify(settings.body).includes('abcdefghijklmnop'));
  // Ni via la liste des kanbans, visible de tous les membres.
  const kanbans = await request(app).get('/api/kanbans').set('Authorization', `Bearer ${memberToken}`);
  assert.ok(!JSON.stringify(kanbans.body).includes('abcdefghijklmnop'));
});

test('PUT /discord/webhook avec une valeur vide retire le webhook', async () => {
  await api('put', '/discord/webhook').send({ webhook_url: WEBHOOK });
  const res = await api('put', '/discord/webhook').send({ webhook_url: '' });
  assert.equal(res.body.webhook_configured, false);
  assert.equal((await api('get', '/discord')).body.webhook_configured, false);
});

test('PATCH /discord/members/:userId enregistre, valide et efface webhook et ID Discord', async () => {
  const badWebhook = await api('patch', `/discord/members/${aliceId}`).send({ discord_webhook_url: 'https://evil.example/x' });
  assert.equal(badWebhook.status, 400);
  const badId = await api('patch', `/discord/members/${aliceId}`).send({ discord_user_id: '12abc' });
  assert.equal(badId.status, 400);

  const ok = await api('patch', `/discord/members/${aliceId}`).send({
    discord_webhook_url: ALICE_WEBHOOK,
    discord_user_id: ALICE_DISCORD,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.webhook_configured, true);
  assert.equal(ok.body.webhook_url_hint, 'https://discord.com/api/webhooks/111111111111111111/••••••');
  assert.equal(ok.body.discord_user_id, ALICE_DISCORD);
  // Le jeton du webhook perso n'est jamais renvoyé.
  assert.ok(!JSON.stringify(ok.body).includes('alicealice'));
  const settings = await api('get', '/discord');
  assert.ok(!JSON.stringify(settings.body).includes('alicealice'));

  const cleared = await api('patch', `/discord/members/${aliceId}`).send({ discord_webhook_url: '' });
  assert.equal(cleared.body.webhook_configured, false);
  assert.equal(cleared.body.discord_user_id, ALICE_DISCORD);
});

test("PATCH /discord/members/:userId sur un non-membre retourne 404", async () => {
  const res = await api('patch', '/discord/members/9999').send({ discord_user_id: ALICE_DISCORD });
  assert.equal(res.status, 404);
});

test('POST /discord/test envoie via le webhook du tableau, ou via celui du membre choisi', async () => {
  assert.equal((await api('post', '/discord/test')).status, 400); // pas de webhook

  await configureDiscord();
  assert.equal((await api('post', '/discord/test')).status, 204);
  assert.equal((await api('post', '/discord/test').send({ user_id: aliceId })).status, 204);
  assert.equal((await api('post', '/discord/test').send({ user_id: bobId })).status, 204);

  assert.equal(sent.length, 3);
  assert.equal(sent[0].url, WEBHOOK);
  assert.equal(sent[1].url, ALICE_WEBHOOK);
  assert.deepEqual(sent[1].payload.allowed_mentions, { parse: [], users: [ALICE_DISCORD] });
  // Bob n'a pas de webhook perso : webhook du tableau.
  assert.equal(sent[2].url, WEBHOOK);
  assert.match(sent[2].payload.content, /bob n'a pas de webhook/);
});

test("POST /discord/test pour un membre sans webhook, et sans webhook de tableau, retourne 400", async () => {
  const res = await api('post', '/discord/test').send({ user_id: bobId });
  assert.equal(res.status, 400);
});

test('POST /discord/test remonte une erreur 502 si Discord refuse', async () => {
  await configureDiscord();
  failNext = true;
  const res = await api('post', '/discord/test');
  assert.equal(res.status, 502);
});

// --- Événements -----------------------------------------------------------------

test("sans webhook configuré, rien n'est envoyé", async () => {
  await createCard({ assigned_user_id: aliceId });
  assert.equal(sent.length, 0);
});

test("sans webhook de tableau, seuls les membres ayant leur propre webhook reçoivent le message", async () => {
  await api('patch', `/discord/members/${aliceId}`).send({ discord_webhook_url: ALICE_WEBHOOK });
  const cardId = await createCard({ assigned_user_id: aliceId });
  await api('post', `/cards/${cardId}/assignees`).send({ action: 'add', user_id: bobId });

  // Création + ajout de Bob : toujours et seulement vers le salon d'Alice.
  assert.equal(sent.length, 2);
  sent.forEach(({ url }) => assert.equal(url, ALICE_WEBHOOK));
});

test('nouveau ticket assigné : message dans le salon du responsable principal, avec mention', async () => {
  await configureDiscord();
  await createCard({ assigned_user_id: aliceId });

  assert.equal(sent.length, 1);
  const msg = byDestination().alice;
  assert.match(msg.content, new RegExp(`^<@${ALICE_DISCORD}> \\*\\*\\[TK-TEST-\\d+\\] Vidéo A\\*\\*`));
  assert.match(msg.content, /Nouveau ticket créé par admin/);
  assert.deepEqual(msg.allowed_mentions, { parse: [], users: [ALICE_DISCORD] });
});

test("ajout d'un responsable : chaque responsable reçoit le message, seul le principal est mentionné", async () => {
  await configureDiscord();
  const cardId = await createCard({ assigned_user_id: aliceId });
  sent = [];

  await api('post', `/cards/${cardId}/assignees`).send({ action: 'add', user_id: bobId });

  const msgs = byDestination();
  assert.equal(sent.length, 2);
  // Alice (principale) dans son fil, mentionnée.
  assert.ok(msgs.alice.content.startsWith(`<@${ALICE_DISCORD}>`));
  assert.deepEqual(msgs.alice.allowed_mentions.users, [ALICE_DISCORD]);
  // Bob (additionnel, sans fil) dans le salon principal, sans mention.
  assert.ok(!msgs.main.content.includes('<@'));
  assert.deepEqual(msgs.main.allowed_mentions, { parse: [], users: [] });
  assert.match(msgs.main.content, /admin a ajouté bob comme responsable/);
});

test("remplacement du principal : le nouveau principal est mentionné, l'ancien est prévenu sans mention", async () => {
  await configureDiscord();
  const cardId = await createCard({ assigned_user_id: aliceId });
  sent = [];

  await api('post', `/cards/${cardId}/assignees`).send({ action: 'replace', user_id: bobId, reason: 'Alice en congés' });

  const msgs = byDestination();
  assert.equal(sent.length, 2);
  assert.ok(msgs.main.content.startsWith(`<@${BOB_DISCORD}>`));
  assert.match(msgs.main.content, /responsable principal à la place de alice/);
  assert.match(msgs.main.content, /Raison : Alice en congés/);
  assert.ok(!msgs.alice.content.includes('<@'));
});

test('nouveau commentaire : envoyé aux responsables, sans aucune mention', async () => {
  await configureDiscord();
  const cardId = await createCard({ assigned_user_id: aliceId });
  await api('post', `/cards/${cardId}/assignees`).send({ action: 'add', user_id: bobId });
  sent = [];

  await api('post', `/cards/${cardId}/comments`).send({ body: '<p>Le <b>montage</b> est prêt &amp; validé</p>' });

  assert.equal(sent.length, 2);
  sent.forEach(({ payload }) => {
    assert.ok(!payload.content.includes('<@'));
    assert.deepEqual(payload.allowed_mentions, { parse: [], users: [] });
    assert.match(payload.content, /admin a commenté :\n> Le montage est prêt & validé/);
  });
});

test("l'auteur de l'action ne reçoit pas le message", async () => {
  await configureDiscord();
  const cardId = await createCard({ assigned_user_id: aliceId });
  await api('post', `/cards/${cardId}/assignees`).send({ action: 'add', user_id: bobId });
  sent = [];

  await request(app)
    .post(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`)
    .set('Authorization', `Bearer ${aliceToken}`)
    .send({ body: 'Je regarde' });

  assert.deepEqual(Object.keys(byDestination()), ['main']); // seulement Bob
});

test("changement d'état (déplacement, annulation) : envoyé avec mention du principal", async () => {
  await configureDiscord();
  const cardId = await createCard({ assigned_user_id: aliceId });
  sent = [];

  await api('patch', `/cards/${cardId}/move`).send({ columnId: columns[1].id });
  assert.equal(sent.length, 1);
  assert.match(sent[0].payload.content, new RegExp(`Statut : « ${columns[0].name} » → « ${columns[1].name} »`));
  assert.ok(sent[0].payload.content.startsWith(`<@${ALICE_DISCORD}>`));

  sent = [];
  await api('patch', `/cards/${cardId}/cancel`);
  assert.equal(sent.length, 1);
  assert.match(sent[0].payload.content, /Ticket annulé par admin/);
});

test("un échec côté Discord ne fait pas échouer l'action", async () => {
  await configureDiscord();
  failNext = true;
  const res = await api('post', '/cards').send({ title: 'Vidéo B', column_id: columns[0].id, assigned_user_id: aliceId });
  assert.equal(res.status, 201);
});

test('les mentions @everyone dans un titre ne sont jamais autorisées', async () => {
  await configureDiscord();
  await createCard({ title: '@everyone urgent', assigned_user_id: aliceId });
  assert.deepEqual(sent[0].payload.allowed_mentions.parse, []);
});
