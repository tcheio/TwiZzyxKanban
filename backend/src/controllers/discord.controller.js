const db = require('../db/connection');
const { isValidWebhookUrl, isValidSnowflake, webhookHint, getWebhookUrl, send } = require('../utils/discord');

// Configuration Discord d'un kanban (réservée à ses modérateurs). Les URL complètes de
// webhook ne sont jamais renvoyées (elles contiennent un jeton secret) : seulement un aperçu.

const MEMBER_SELECT = `
  SELECT users.id AS user_id, users.username, users.avatar_url,
         kanban_members.discord_webhook_url, kanban_members.discord_user_id
  FROM kanban_members
  JOIN users ON users.id = kanban_members.user_id
  WHERE kanban_members.kanban_id = ?`;

function toMemberDto({ discord_webhook_url, ...member }) {
  return {
    ...member,
    webhook_configured: !!discord_webhook_url,
    webhook_url_hint: webhookHint(discord_webhook_url),
  };
}

function getSettings(req, res) {
  const webhookUrl = getWebhookUrl(req.kanbanId);
  const members = db.prepare(`${MEMBER_SELECT} ORDER BY users.username`).all(req.kanbanId);

  res.json({
    webhook_configured: !!webhookUrl,
    webhook_url_hint: webhookHint(webhookUrl),
    members: members.map(toMemberDto),
  });
}

// Normalise une valeur de formulaire : chaîne vide / null = « retirer ».
function cleanValue(raw) {
  return raw === null || raw === undefined ? '' : String(raw).trim();
}

const INVALID_WEBHOOK_MESSAGE = 'doit être une URL de webhook Discord (https://discord.com/api/webhooks/…)';

// Définit (ou retire, avec une valeur vide / null) le webhook par défaut du kanban.
function setWebhook(req, res) {
  const webhookUrl = cleanValue(req.body?.webhook_url);

  if (!webhookUrl) {
    db.prepare('DELETE FROM kanban_discord WHERE kanban_id = ?').run(req.kanbanId);
    return res.json({ webhook_configured: false, webhook_url_hint: null });
  }
  if (!isValidWebhookUrl(webhookUrl)) {
    return res.status(400).json({ error: `webhook_url ${INVALID_WEBHOOK_MESSAGE}` });
  }

  db.prepare(
    `INSERT INTO kanban_discord (kanban_id, webhook_url) VALUES (?, ?)
     ON CONFLICT(kanban_id) DO UPDATE SET webhook_url = excluded.webhook_url`
  ).run(req.kanbanId, webhookUrl);
  res.json({ webhook_configured: true, webhook_url_hint: webhookHint(webhookUrl) });
}

// Webhook (salon) et ID Discord d'un membre — valeur vide / null = retirer.
function setMember(req, res) {
  const userId = Number(req.params.userId);
  const member = db
    .prepare('SELECT user_id FROM kanban_members WHERE kanban_id = ? AND user_id = ?')
    .get(req.kanbanId, userId);
  if (!member) {
    return res.status(404).json({ error: "Cette personne n'est pas membre du kanban" });
  }

  const body = req.body || {};
  const updates = {};
  if ('discord_webhook_url' in body) {
    const value = cleanValue(body.discord_webhook_url);
    if (value && !isValidWebhookUrl(value)) {
      return res.status(400).json({ error: `discord_webhook_url ${INVALID_WEBHOOK_MESSAGE}` });
    }
    updates.discord_webhook_url = value || null;
  }
  if ('discord_user_id' in body) {
    const value = cleanValue(body.discord_user_id);
    if (value && !isValidSnowflake(value)) {
      return res.status(400).json({ error: 'discord_user_id doit être un identifiant Discord (17 à 20 chiffres)' });
    }
    updates.discord_user_id = value || null;
  }

  Object.entries(updates).forEach(([field, value]) => {
    db.prepare(`UPDATE kanban_members SET ${field} = ? WHERE kanban_id = ? AND user_id = ?`).run(
      value,
      req.kanbanId,
      userId
    );
  });

  const updated = db.prepare(`${MEMBER_SELECT} AND kanban_members.user_id = ?`).get(req.kanbanId, userId);
  res.json(toMemberDto(updated));
}

// Envoie un message de test via le webhook du kanban, ou via celui d'un membre si
// `user_id` est fourni (à défaut de webhook perso, celui du kanban), pour vérifier la
// configuration.
async function sendTest(req, res) {
  const defaultWebhookUrl = getWebhookUrl(req.kanbanId);
  let webhookUrl = defaultWebhookUrl;
  let mentionUserId = null;
  let target = 'le salon par défaut du tableau';

  if (req.body?.user_id) {
    const member = db.prepare(`${MEMBER_SELECT} AND kanban_members.user_id = ?`).get(req.kanbanId, Number(req.body.user_id));
    if (!member) {
      return res.status(404).json({ error: "Cette personne n'est pas membre du kanban" });
    }
    webhookUrl = member.discord_webhook_url || defaultWebhookUrl;
    mentionUserId = member.discord_user_id;
    target = member.discord_webhook_url
      ? `le salon de ${member.username}`
      : `le salon par défaut du tableau (${member.username} n'a pas de webhook)`;
  }

  if (!webhookUrl) {
    return res.status(400).json({ error: "Aucun webhook Discord n'est configuré" });
  }

  try {
    await send(webhookUrl, {
      content: `${mentionUserId ? `<@${mentionUserId}> ` : ''}✅ Message de test de TwiZzyxKanban, envoyé dans ${target} par ${req.user.username}.`,
      mentionUserId,
    });
    res.status(204).send();
  } catch (err) {
    res.status(502).json({ error: `Échec de l'envoi vers Discord : ${err?.message ?? err}` });
  }
}

module.exports = { getSettings, setWebhook, setMember, sendTest };
