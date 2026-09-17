import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../models/tag.model';

@Injectable({ providedIn: 'root' })
export class TagsService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number): Promise<Tag[]> {
    return firstValueFrom(this.http.get<Tag[]>(`/api/kanbans/${kanbanId}/tags`));
  }

  create(kanbanId: number, name: string, color: string, emoteUrl: string | null = null): Promise<Tag> {
    return firstValueFrom(
      this.http.post<Tag>(`/api/kanbans/${kanbanId}/tags`, { name, color, emote_url: emoteUrl })
    );
  }

  update(kanbanId: number, id: number, changes: { name?: string; color?: string; emote_url?: string | null }): Promise<Tag> {
    return firstValueFrom(this.http.patch<Tag>(`/api/kanbans/${kanbanId}/tags/${id}`, changes));
  }

  remove(kanbanId: number, id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/tags/${id}`));
  }
}
