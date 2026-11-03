import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DiscordMemberField,
  DiscordMemberSettings,
  DiscordSettings,
  DiscordWebhookStatus,
} from '../../models/discord.model';

@Injectable({ providedIn: 'root' })
export class DiscordService {
  constructor(private readonly http: HttpClient) {}

  get(kanbanId: number): Promise<DiscordSettings> {
    return firstValueFrom(this.http.get<DiscordSettings>(`/api/kanbans/${kanbanId}/discord`));
  }

  // `null` ou chaîne vide : retire le webhook.
  setWebhook(kanbanId: number, webhookUrl: string | null): Promise<DiscordWebhookStatus> {
    return firstValueFrom(
      this.http.put<DiscordWebhookStatus>(`/api/kanbans/${kanbanId}/discord/webhook`, { webhook_url: webhookUrl })
    );
  }

  setMember(kanbanId: number, userId: number, field: DiscordMemberField, value: string | null): Promise<DiscordMemberSettings> {
    return firstValueFrom(
      this.http.patch<DiscordMemberSettings>(`/api/kanbans/${kanbanId}/discord/members/${userId}`, { [field]: value })
    );
  }

  // Sans userId : test via le webhook du tableau ; avec : via celui de ce membre.
  sendTest(kanbanId: number, userId?: number): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`/api/kanbans/${kanbanId}/discord/test`, userId ? { user_id: userId } : {})
    );
  }
}
