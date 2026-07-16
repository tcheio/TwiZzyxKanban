import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Comment } from '../models/comment.model';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number, cardId: number): Promise<Comment[]> {
    return firstValueFrom(this.http.get<Comment[]>(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`));
  }

  create(kanbanId: number, cardId: number, body: string): Promise<Comment> {
    return firstValueFrom(this.http.post<Comment>(`/api/kanbans/${kanbanId}/cards/${cardId}/comments`, { body }));
  }

  remove(kanbanId: number, cardId: number, commentId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/cards/${cardId}/comments/${commentId}`));
  }
}
