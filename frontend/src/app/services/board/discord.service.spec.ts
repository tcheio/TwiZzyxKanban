import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DiscordService } from './discord.service';

describe('DiscordService', () => {
  let service: DiscordService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DiscordService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('get() effectue un GET /api/kanbans/:id/discord', async () => {
    const promise = service.get(4);
    const req = httpMock.expectOne('/api/kanbans/4/discord');
    expect(req.request.method).toBe('GET');
    req.flush({ webhook_configured: false, webhook_url_hint: null, members: [] });
    expect((await promise).webhook_configured).toBe(false);
  });

  it('setWebhook() envoie un PUT avec webhook_url (null pour retirer)', async () => {
    const promise = service.setWebhook(4, null);
    const req = httpMock.expectOne('/api/kanbans/4/discord/webhook');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ webhook_url: null });
    req.flush({ webhook_configured: false, webhook_url_hint: null });
    await promise;
  });

  it('setMember() envoie un PATCH ne contenant que le champ modifié', async () => {
    const promise = service.setMember(4, 7, 'discord_user_id', '111111111111111111');
    const req = httpMock.expectOne('/api/kanbans/4/discord/members/7');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ discord_user_id: '111111111111111111' });
    req.flush({});
    await promise;
  });

  it('sendTest() envoie user_id seulement quand un membre est visé', async () => {
    const toChannel = service.sendTest(4);
    const req1 = httpMock.expectOne('/api/kanbans/4/discord/test');
    expect(req1.request.body).toEqual({});
    req1.flush(null);
    await toChannel;

    const toMember = service.sendTest(4, 7);
    const req2 = httpMock.expectOne('/api/kanbans/4/discord/test');
    expect(req2.request.body).toEqual({ user_id: 7 });
    req2.flush(null);
    await toMember;
  });
});
