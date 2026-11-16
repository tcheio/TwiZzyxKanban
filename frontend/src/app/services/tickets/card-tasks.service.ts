import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardTask, CardTaskInput, CardTaskUpdate } from '../../models/card-task.model';

@Injectable({ providedIn: 'root' })
export class CardTasksService {
  constructor(private readonly http: HttpClient) {}

  private url(kanbanId: number, cardId: number): string {
    return `/api/kanbans/${kanbanId}/cards/${cardId}/tasks`;
  }

  list(kanbanId: number, cardId: number): Promise<CardTask[]> {
    return firstValueFrom(this.http.get<CardTask[]>(this.url(kanbanId, cardId)));
  }

  create(kanbanId: number, cardId: number, input: CardTaskInput): Promise<CardTask> {
    return firstValueFrom(this.http.post<CardTask>(this.url(kanbanId, cardId), input));
  }

  update(kanbanId: number, cardId: number, taskId: number, changes: CardTaskUpdate): Promise<CardTask> {
    return firstValueFrom(this.http.patch<CardTask>(`${this.url(kanbanId, cardId)}/${taskId}`, changes));
  }

  remove(kanbanId: number, cardId: number, taskId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.url(kanbanId, cardId)}/${taskId}`));
  }
}
