import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card } from '../models/card.model';

@Injectable({ providedIn: 'root' })
export class CardTagsService {
  constructor(private readonly http: HttpClient) {}

  add(kanbanId: number, cardId: number, tagId: number): Promise<Card> {
    return firstValueFrom(this.http.post<Card>(`/api/kanbans/${kanbanId}/cards/${cardId}/tags`, { tag_id: tagId }));
  }

  remove(kanbanId: number, cardId: number, tagId: number): Promise<Card> {
    return firstValueFrom(this.http.delete<Card>(`/api/kanbans/${kanbanId}/cards/${cardId}/tags/${tagId}`));
  }
}
