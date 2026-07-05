import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card, CardInput } from '../models/card.model';

@Injectable({ providedIn: 'root' })
export class CardsService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<Card[]> {
    return firstValueFrom(this.http.get<Card[]>('/api/cards'));
  }

  get(id: number): Promise<Card> {
    return firstValueFrom(this.http.get<Card>(`/api/cards/${id}`));
  }

  create(input: CardInput): Promise<Card> {
    return firstValueFrom(this.http.post<Card>('/api/cards', input));
  }

  update(id: number, input: Partial<CardInput>): Promise<Card> {
    return firstValueFrom(this.http.patch<Card>(`/api/cards/${id}`, input));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/cards/${id}`));
  }

  move(id: number, columnId: number, position?: number): Promise<Card> {
    const body: { columnId: number; position?: number } = { columnId };
    if (position !== undefined) {
      body.position = position;
    }
    return firstValueFrom(this.http.patch<Card>(`/api/cards/${id}/move`, body));
  }
}
