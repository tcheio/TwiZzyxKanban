const db = require('../db/connection');
const { getCardWatchers } = require('./notify');

// Intégration Discord d'un kanban.
//
// Un webhook Discord n'écrit que dans UN salon : chaque membre peut donc avoir son propre
// webhook (le salon Discord où lui écrire). Un membre sans webhook perso reçoit le message
// via le webhook par défaut du kanban, s'il y en a un ; sinon il ne reçoit rien.
// Chaque responsable courant du ticket (principal ou additionnel, hors auteur de l'action)
// reçoit le message. Mentions :
//   - le responsable principal est mentionné (sauf événements sans mention, ex. commentaire) ;
//   - un responsable additionnel n'est JAMAIS mentionné, sauf dans l'événement qui vient de
//     l'ajouter comme responsable (cf `extraMentionUserIds`).
// Une mention n'apparaît que dans le message destiné à la personne concernée (son salon),
// pour qu'elle ne soit pas notifiée plusieurs fois.

// Restreint aux URL de webhook Discord : le serveur fait un POST vers cette URL, on ne
// doit pas pouvoir lui faire appeler n'importe quelle adresse.
const WEBHOOK_URL_PATTERN = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/(\d{17,20})\/[\w-]{20,}$/;
// Identifiants Discord ("snowflakes") des utilisateurs.
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

const MAX_CONTENT_LENGTH = 2000;

function isValidWebhookUrl(url) {
  return typeof url === 'string' && WEBHOOK_URL_PATTERN.test(url);
}

function isValidSnowflake(value) {
  return typeof value === 'string' && SNOWFLAKE_PATTERN.test(value);
}

// Version affichable d'un webhook configuré : l'ID n'est pas secret, le jeton si.
function webhookHint(url) {
  const match = WEBHOOK_URL_PATTERN.exec(url || '');
  return match ? `https://discord.com/api/webhooks/${match[1]}/••••••` : null;
}

async function fetchTransport(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Discord a répondu ${res.status}`);
  }
}

let transport = fetchTransport;

// Pour les tests : remplace l'envoi HTTP réel (et renvoie l'ancien transport).
function setTransport(fn) {
  const previous = transport;
  transport = fn || fetchTransport;
  return previous;
}

function getWebhookUrl(kanbanId) {
  return db.prepare('SELECT webhook_url FROM kanban_discord WHERE kanban_id = ?').get(kanbanId)?.webhook_url ?? null;
}

// `mentionUserIds` : IDs Discord à mentionner, placés en tête du message.
function send(webhookUrl, { content, mentionUserIds = [] }) {
  const mentions = mentionUserIds.map((id) => `<@${id}>`).join(' ');
  const fullContent = mentions ? `${mentions} ${content}` : content;
  return transport(webhookUrl, {
    username: 'TwiZzyxKanban',
    content: fullContent.length > MAX_CONTENT_LENGTH ? `${fullContent.slice(0, MAX_CONTENT_LENGTH - 1)}…` : fullContent,
    // Jamais de @everyone/@here/rôles venant d'un titre ou d'un commentaire : seules les
    // mentions explicitement demandées peuvent notifier quelqu'un.
    allowed_mentions: { parse: [], users: mentionUserIds },
  });
}

// Texte brut (pour Discord) à partir du HTML riche des commentaires.
function richTextExcerpt(html, maxLength = 300) {
  const text = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function ticketHeader(card, kanbanCode) {
  const key = `${kanbanCode}-${card.id}`;
  const baseUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
  const link = baseUrl ? ` — <${baseUrl}/kanbans/${key}>` : '';
  return `**[${key}] ${card.title}**${link}`;
}

// Envoie un événement de ticket sur Discord à ses responsables. Ne lève jamais : un
// souci côté Discord ne doit pas faire échouer l'action de l'utilisateur. Renvoie une
// promesse (utile aux tests) qu'il n'est pas nécessaire d'attendre.
// - mentionPrimary : mentionner le responsable principal (false pour un commentaire) ;
// - extraMentionUserIds : autres personnes à mentionner (ex. le responsable additionnel
//   qu'on vient d'ajouter) ;
// - extraUserIds : destinataires en plus des responsables courants (ex. la personne
//   remplacée, qui n'est plus responsable mais doit être prévenue — sans mention).
async function notifyDiscord(
  cardId,
  { kanbanId, actorUserId, message, mentionPrimary = true, extraMentionUserIds = [], extraUserIds = [] }
) {
  try {
    const card = db.prepare('SELECT id, title, assigned_user_id FROM cards WHERE id = ?').get(cardId);
    const kanban = db.prepare('SELECT code FROM kanbans WHERE id = ?').get(kanbanId);
    if (!card || !kanban) return;

    const recipients = [...new Set([...getCardWatchers(cardId), ...extraUserIds])].filter(
      (id) => id && id !== actorUserId
    );
    if (recipients.length === 0) return;

    const defaultWebhookUrl = getWebhookUrl(kanbanId);
    const memberSettings = new Map(
      db
        .prepare('SELECT user_id, discord_webhook_url, discord_user_id FROM kanban_members WHERE kanban_id = ?')
        .all(kanbanId)
        .map((m) => [m.user_id, m])
    );

    // Un message par webhook (salon) : plusieurs membres qui partagent le même salon —
    // typiquement celui du kanban, faute de webhook perso — ne reçoivent qu'un message.
    const destinations = new Map();
    recipients.forEach((userId) => {
      const webhookUrl = memberSettings.get(userId)?.discord_webhook_url || defaultWebhookUrl;
      if (!webhookUrl) return;
      if (!destinations.has(webhookUrl)) destinations.set(webhookUrl, []);
      destinations.get(webhookUrl).push(userId);
    });
    if (destinations.size === 0) return;

    const header = ticketHeader(card, kanban.code);
    const mentioned = new Set(extraMentionUserIds);
    if (mentionPrimary && card.assigned_user_id) mentioned.add(card.assigned_user_id);

    const sends = [...destinations.entries()].map(([webhookUrl, userIds]) => {
      const mentionUserIds = userIds
        .filter((id) => mentioned.has(id))
        .map((id) => memberSettings.get(id)?.discord_user_id)
        .filter(Boolean);
      return send(webhookUrl, { content: `${header}\n${message}`, mentionUserIds });
    });

    const results = await Promise.allSettled(sends);
    results
      .filter((r) => r.status === 'rejected')
      .forEach((r) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`[discord] Échec d'envoi pour le kanban ${kanbanId} : ${r.reason?.message ?? r.reason}`);
        }
      });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[discord] Erreur inattendue : ${err?.message ?? err}`);
    }
  }
}

module.exports = {
  isValidWebhookUrl,
  isValidSnowflake,
  webhookHint,
  getWebhookUrl,
  send,
  setTransport,
  richTextExcerpt,
  notifyDiscord,
};
