import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiscordService } from '../../../../services/board/discord.service';
import { DiscordMemberSettings } from '../../../../models/discord.model';

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const WEBHOOK_URL_PATTERN = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[\w-]{20,}$/;

export function isDiscordWebhookUrl(value: string): boolean {
  return WEBHOOK_URL_PATTERN.test(value.trim());
}

// Section "Notifications Discord" des paramètres du tableau : webhook par défaut du
// kanban, et pour chaque membre le webhook de son salon et son ID Discord (mention).
@Component({
  selector: 'app-discord-settings',
  imports: [FormsModule],
  templateUrl: './discord-settings.html',
})
export class DiscordSettings implements OnInit {
  private readonly discordService = inject(DiscordService);

  @Input({ required: true }) kanbanId!: number;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

  readonly webhookConfigured = signal(false);
  readonly webhookHint = signal<string | null>(null);
  readonly webhookInput = signal('');
  readonly members = signal<DiscordMemberSettings[]>([]);
  // Saisie en cours du webhook de chaque membre (clé : user_id).
  readonly memberWebhookInputs = signal<Record<number, string>>({});

  readonly isDiscordWebhookUrl = isDiscordWebhookUrl;

  async ngOnInit(): Promise<void> {
    try {
      const settings = await this.discordService.get(this.kanbanId);
      this.webhookConfigured.set(settings.webhook_configured);
      this.webhookHint.set(settings.webhook_url_hint);
      this.members.set(settings.members);
    } catch {
      this.error.set('Impossible de charger les réglages Discord.');
    } finally {
      this.loading.set(false);
    }
  }

  // --- Webhook par défaut du tableau ---

  async saveWebhook(): Promise<void> {
    if (!isDiscordWebhookUrl(this.webhookInput())) return;
    await this.run(async () => {
      const status = await this.discordService.setWebhook(this.kanbanId, this.webhookInput().trim());
      this.webhookConfigured.set(status.webhook_configured);
      this.webhookHint.set(status.webhook_url_hint);
      this.webhookInput.set('');
      this.info.set('Webhook du tableau enregistré.');
    }, "Échec de l'enregistrement du webhook.");
  }

  async removeWebhook(): Promise<void> {
    if (!confirm('Retirer le webhook du tableau ? Les membres sans webhook perso ne recevront plus rien sur Discord.')) {
      return;
    }
    await this.run(async () => {
      await this.discordService.setWebhook(this.kanbanId, null);
      this.webhookConfigured.set(false);
      this.webhookHint.set(null);
      this.info.set('Webhook du tableau retiré.');
    }, 'Échec du retrait du webhook.');
  }

  // --- Réglages par membre ---

  memberWebhookInput(member: DiscordMemberSettings): string {
    return this.memberWebhookInputs()[member.user_id] ?? '';
  }

  setMemberWebhookInput(member: DiscordMemberSettings, value: string): void {
    this.memberWebhookInputs.update((inputs) => ({ ...inputs, [member.user_id]: value }));
  }

  async saveMemberWebhook(member: DiscordMemberSettings): Promise<void> {
    const value = this.memberWebhookInput(member).trim();
    if (!isDiscordWebhookUrl(value)) return;
    await this.run(async () => {
      this.replaceMember(await this.discordService.setMember(this.kanbanId, member.user_id, 'discord_webhook_url', value));
      this.setMemberWebhookInput(member, '');
      this.info.set(`Webhook de ${member.username} enregistré.`);
    }, `Échec de l'enregistrement pour ${member.username}.`);
  }

  async removeMemberWebhook(member: DiscordMemberSettings): Promise<void> {
    if (!confirm(`Retirer le webhook de ${member.username} ? Ses messages passeront par le webhook du tableau.`)) return;
    await this.run(async () => {
      this.replaceMember(await this.discordService.setMember(this.kanbanId, member.user_id, 'discord_webhook_url', null));
      this.info.set(`Webhook de ${member.username} retiré.`);
    }, `Échec du retrait pour ${member.username}.`);
  }

  isValidDiscordId(value: string): boolean {
    return value === '' || SNOWFLAKE_PATTERN.test(value);
  }

  async updateDiscordUserId(member: DiscordMemberSettings, rawValue: string): Promise<void> {
    const value = rawValue.trim();
    if ((member.discord_user_id ?? '') === value) return;
    if (!this.isValidDiscordId(value)) {
      this.error.set('Un identifiant Discord est composé de 17 à 20 chiffres.');
      return;
    }
    await this.run(async () => {
      this.replaceMember(
        await this.discordService.setMember(this.kanbanId, member.user_id, 'discord_user_id', value || null)
      );
    }, `Échec de l'enregistrement pour ${member.username}.`);
  }

  // Un membre peut recevoir des messages s'il a son webhook, ou à défaut celui du tableau.
  canReceive(member: DiscordMemberSettings): boolean {
    return member.webhook_configured || this.webhookConfigured();
  }

  async sendTest(member?: DiscordMemberSettings): Promise<void> {
    await this.run(async () => {
      await this.discordService.sendTest(this.kanbanId, member?.user_id);
      this.info.set(
        member
          ? `Message de test envoyé à ${member.username}${member.webhook_configured ? ' (son salon)' : ' (salon du tableau)'}.`
          : 'Message de test envoyé dans le salon du tableau.'
      );
    }, "Échec de l'envoi du message de test : vérifiez le webhook.");
  }

  private replaceMember(updated: DiscordMemberSettings): void {
    this.members.update((list) => list.map((m) => (m.user_id === updated.user_id ? updated : m)));
  }

  private async run(action: () => Promise<void>, errorMessage: string): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      await action();
    } catch (err: unknown) {
      const message = (err as { error?: { error?: string } })?.error?.error;
      this.error.set(message ?? errorMessage);
    } finally {
      this.saving.set(false);
    }
  }
}
