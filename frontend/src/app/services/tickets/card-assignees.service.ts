import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Card } from '../models/card.model';
import { AssignmentInput, CardAssignee } from '../models/card-assignee.model';
import { CardAssignmentHistoryEntry } from '../models/card-assignment-history.model';

@Injectable({ providedIn: 'root' })
export class CardAssigneesService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number, cardId: number): Promise<CardAssignee[]> {
    return firstValueFrom(this.http.get<CardAssignee[]>(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`));
  }

  history(kanbanId: number, cardId: number): Promise<CardAssignmentHistoryEntry[]> {
    return firstValueFrom(
      this.http.get<CardAssignmentHistoryEntry[]>(`/api/kanbans/${kanbanId}/cards/${cardId}/assignment-history`)
    );
  }

  upsert(kanbanId: number, cardId: number, input: AssignmentInput): Promise<Card> {
    return firstValueFrom(this.http.post<Card>(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees`, input));
  }

  remove(kanbanId: number, cardId: number, userId: number, reason: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/kanbans/${kanbanId}/cards/${cardId}/assignees/${userId}`, { body: { reason } })
    );
  }
}
