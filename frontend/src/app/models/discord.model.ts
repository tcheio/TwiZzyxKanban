// Webhook Discord tel que renvoyé par l'API : jamais l'URL complète (elle contient un
// jeton secret), seulement un aperçu, ex. https://discord.com/api/webhooks/123…/••••••
export interface DiscordWebhookStatus {
  webhook_configured: boolean;
  webhook_url_hint: string | null;
}

// Réglages Discord d'un membre du kanban (cf backend/src/controllers/discord.controller.js).
// Son webhook est celui de son salon Discord ; sans webhook perso, il reçoit ses messages
// via le webhook par défaut du tableau.
export interface DiscordMemberSettings extends DiscordWebhookStatus {
  user_id: number;
  username: string;
  avatar_url?: string | null;
  // ID Discord du membre, pour le mentionner quand il est responsable principal.
  discord_user_id: string | null;
}

export interface DiscordSettings extends DiscordWebhookStatus {
  members: DiscordMemberSettings[];
}

export type DiscordMemberField = 'discord_webhook_url' | 'discord_user_id';
