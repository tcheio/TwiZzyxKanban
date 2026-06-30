import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Comment } from '../models/comment.model';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  constructor(private http: HttpClient) {}

  list(cardId: number): Promise<Comment[]> {
    return firstValueFrom(this.http.get<Comment[]>(`/api/cards/${cardId}/comments`));
  }

  create(cardId: number, body: string): Promise<Comment> {
    return firstValueFrom(this.http.post<Comment>(`/api/cards/${cardId}/comments`, { body }));
  }

  remove(cardId: number, commentId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/cards/${cardId}/comments/${commentId}`));
  }
}
