import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardLink, CardLinkType } from '../models/card-link.model';

@Injectable({ providedIn: 'root' })
export class CardLinksService {
  constructor(private readonly http: HttpClient) {}

  list(cardId: number): Promise<CardLink[]> {
    return firstValueFrom(this.http.get<CardLink[]>(`/api/cards/${cardId}/links`));
  }

  create(cardId: number, linkedCardId: number, type: CardLinkType): Promise<CardLink> {
    return firstValueFrom(
      this.http.post<CardLink>(`/api/cards/${cardId}/links`, { linked_card_id: linkedCardId, type })
    );
  }

  remove(cardId: number, linkId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/cards/${cardId}/links/${linkId}`));
  }
}
