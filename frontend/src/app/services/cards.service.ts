import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card, CardInput } from '../models/card.model';

@Injectable({ providedIn: 'root' })
export class CardsService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number): Promise<Card[]> {
    return firstValueFrom(this.http.get<Card[]>(`/api/kanbans/${kanbanId}/cards`));
  }

  get(kanbanId: number, id: number): Promise<Card> {
    return firstValueFrom(this.http.get<Card>(`/api/kanbans/${kanbanId}/cards/${id}`));
  }

  create(kanbanId: number, input: CardInput): Promise<Card> {
    return firstValueFrom(this.http.post<Card>(`/api/kanbans/${kanbanId}/cards`, input));
  }

  update(kanbanId: number, id: number, input: Partial<CardInput>): Promise<Card> {
    return firstValueFrom(this.http.patch<Card>(`/api/kanbans/${kanbanId}/cards/${id}`, input));
  }

  remove(kanbanId: number, id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/cards/${id}`));
  }

  move(kanbanId: number, id: number, columnId: number, position?: number): Promise<Card> {
    const body: { columnId: number; position?: number } = { columnId };
    if (position !== undefined) {
      body.position = position;
    }
    return firstValueFrom(this.http.patch<Card>(`/api/kanbans/${kanbanId}/cards/${id}/move`, body));
  }

  cancel(kanbanId: number, id: number): Promise<Card> {
    return firstValueFrom(this.http.patch<Card>(`/api/kanbans/${kanbanId}/cards/${id}/cancel`, {}));
  }

  restore(kanbanId: number, id: number): Promise<Card> {
    return firstValueFrom(this.http.patch<Card>(`/api/kanbans/${kanbanId}/cards/${id}/restore`, {}));
  }
}
