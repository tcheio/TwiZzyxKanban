import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordSettings, isDiscordWebhookUrl } from './discord-settings';
import { DiscordService } from '../../../../services/board/discord.service';
import { DiscordMemberSettings } from '../../../../models/discord.model';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_-0123456789';
const HINT = 'https://discord.com/api/webhooks/123456789012345678/••••••';

describe('DiscordSettings', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<DiscordSettings>>;
  let component: DiscordSettings;
  let discordService: {
    get: ReturnType<typeof vi.fn>;
    setWebhook: ReturnType<typeof vi.fn>;
    setMember: ReturnType<typeof vi.fn>;
    sendTest: ReturnType<typeof vi.fn>;
  };

  const alice: DiscordMemberSettings = {
    user_id: 1,
    username: 'alice',
    webhook_configured: false,
    webhook_url_hint: null,
    discord_user_id: null,
  };

  async function setup({ boardWebhook = false, members = [alice] } = {}): Promise<void> {
    discordService = {
      get: vi.fn().mockResolvedValue({
        webhook_configured: boardWebhook,
        webhook_url_hint: boardWebhook ? HINT : null,
        members,
      }),
      setWebhook: vi.fn().mockImplementation((id, url) =>
        Promise.resolve({ webhook_configured: !!url, webhook_url_hint: url ? HINT : null })
      ),
      setMember: vi.fn().mockImplementation((id, userId, field, value) =>
        Promise.resolve(
          field === 'discord_webhook_url'
            ? { ...alice, webhook_configured: !!value, webhook_url_hint: value ? HINT : null }
            : { ...alice, discord_user_id: value }
        )
      ),
      sendTest: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DiscordSettings],
      providers: [{ provide: DiscordService, useValue: discordService }],
    });
    fixture = TestBed.createComponent(DiscordSettings);
    component = fixture.componentInstance;
    component.kanbanId = 5;
    await component.ngOnInit();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => setup());

  it('isDiscordWebhookUrl() ne reconnaît que les URL de webhook Discord', () => {
    expect(isDiscordWebhookUrl('https://example.com/hook')).toBe(false);
    expect(isDiscordWebhookUrl('https://discord.com/channels/123/456')).toBe(false);
    expect(isDiscordWebhookUrl(` ${WEBHOOK} `)).toBe(true);
  });

  it('charge les réglages et liste les membres', () => {
    expect(discordService.get).toHaveBeenCalledWith(5);
    const rows = el().querySelectorAll('.discord-member');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('alice');
  });

  it("indique d'où partent les messages de chaque membre", async () => {
    expect(el().querySelector('.member-webhook-status')?.textContent).toContain('Aucun envoi');

    await setup({ boardWebhook: true });
    expect(el().querySelector('.member-webhook-status')?.textContent).toContain('Salon du tableau');

    await setup({ members: [{ ...alice, webhook_configured: true, webhook_url_hint: HINT }] });
    expect(el().querySelector('.member-webhook-status')?.textContent).toContain('Son salon');
  });

  it("saveWebhook() enregistre le webhook du tableau, affiche l'aperçu masqué et vide le champ", async () => {
    component.webhookInput.set(`  ${WEBHOOK} `);
    await component.saveWebhook();
    fixture.detectChanges();

    expect(discordService.setWebhook).toHaveBeenCalledWith(5, WEBHOOK);
    expect(component.webhookConfigured()).toBe(true);
    expect(component.webhookInput()).toBe('');
    expect(el().querySelector('.webhook-hint')?.textContent).toContain('••••••');
  });

  it('removeWebhook() demande confirmation puis retire le webhook du tableau', async () => {
    await setup({ boardWebhook: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component.removeWebhook();
    expect(discordService.setWebhook).toHaveBeenCalledWith(5, null);
    expect(component.webhookConfigured()).toBe(false);
  });

  it("removeWebhook() ne fait rien si l'on annule", async () => {
    await setup({ boardWebhook: true });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component.removeWebhook();
    expect(discordService.setWebhook).not.toHaveBeenCalled();
  });

  it('saveMemberWebhook() enregistre le webhook du membre et vide sa saisie', async () => {
    component.setMemberWebhookInput(alice, WEBHOOK);
    await component.saveMemberWebhook(alice);

    expect(discordService.setMember).toHaveBeenCalledWith(5, 1, 'discord_webhook_url', WEBHOOK);
    expect(component.members()[0].webhook_configured).toBe(true);
    expect(component.memberWebhookInput(alice)).toBe('');
  });

  it("saveMemberWebhook() ignore une URL qui n'est pas un webhook", async () => {
    component.setMemberWebhookInput(alice, 'https://discord.com/channels/123/456');
    await component.saveMemberWebhook(alice);
    expect(discordService.setMember).not.toHaveBeenCalled();
  });

  it('removeMemberWebhook() retire le webhook du membre après confirmation', async () => {
    const withWebhook = { ...alice, webhook_configured: true, webhook_url_hint: HINT };
    await setup({ members: [withWebhook] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.removeMemberWebhook(withWebhook);

    expect(discordService.setMember).toHaveBeenCalledWith(5, 1, 'discord_webhook_url', null);
    expect(component.members()[0].webhook_configured).toBe(false);
  });

  it("updateDiscordUserId() enregistre l'ID, ou null pour l'effacer", async () => {
    await component.updateDiscordUserId(alice, ' 222222222222222222 ');
    expect(discordService.setMember).toHaveBeenCalledWith(5, 1, 'discord_user_id', '222222222222222222');
    expect(component.members()[0].discord_user_id).toBe('222222222222222222');

    await component.updateDiscordUserId(component.members()[0], '');
    expect(discordService.setMember).toHaveBeenLastCalledWith(5, 1, 'discord_user_id', null);
  });

  it("updateDiscordUserId() refuse un identifiant invalide sans appeler l'API", async () => {
    await component.updateDiscordUserId(alice, 'abc');
    expect(discordService.setMember).not.toHaveBeenCalled();
    expect(component.error()).toContain('17 à 20 chiffres');
  });

  it('canReceive() : webhook perso, ou à défaut webhook du tableau', async () => {
    expect(component.canReceive(alice)).toBe(false);
    expect(component.canReceive({ ...alice, webhook_configured: true })).toBe(true);
    await setup({ boardWebhook: true });
    expect(component.canReceive(alice)).toBe(true);
  });

  it("sendTest() affiche l'erreur renvoyée par le serveur", async () => {
    discordService.sendTest.mockRejectedValue({ error: { error: "Échec de l'envoi vers Discord : Discord a répondu 404" } });
    await component.sendTest(alice);
    expect(discordService.sendTest).toHaveBeenCalledWith(5, 1);
    expect(component.error()).toContain('404');
  });
});
