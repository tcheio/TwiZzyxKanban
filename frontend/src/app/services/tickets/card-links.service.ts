import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardLink, CardLinkType } from '../models/card-link.model';

@Injectable({ providedIn: 'root' })
export class CardLinksService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number, cardId: number): Promise<CardLink[]> {
    return firstValueFrom(this.http.get<CardLink[]>(`/api/kanbans/${kanbanId}/cards/${cardId}/links`));
  }

  create(kanbanId: number, cardId: number, linkedCardId: number, type: CardLinkType): Promise<CardLink> {
    return firstValueFrom(
      this.http.post<CardLink>(`/api/kanbans/${kanbanId}/cards/${cardId}/links`, { linked_card_id: linkedCardId, type })
    );
  }

  remove(kanbanId: number, cardId: number, linkId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/cards/${cardId}/links/${linkId}`));
  }
}
