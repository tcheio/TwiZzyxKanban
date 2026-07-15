import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Kanban, KanbanInput, KanbanMember } from '../models/kanban.model';
import { UserLite } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class KanbansService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<Kanban[]> {
    return firstValueFrom(this.http.get<Kanban[]>('/api/kanbans'));
  }

  create(input: KanbanInput): Promise<Kanban> {
    return firstValueFrom(this.http.post<Kanban>('/api/kanbans', input));
  }

  rename(id: number, name: string): Promise<Kanban> {
    return firstValueFrom(this.http.patch<Kanban>(`/api/kanbans/${id}`, { name }));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${id}`));
  }

  membersList(kanbanId: number): Promise<KanbanMember[]> {
    return firstValueFrom(this.http.get<KanbanMember[]>(`/api/kanbans/${kanbanId}/members`));
  }

  membersLite(kanbanId: number): Promise<UserLite[]> {
    return firstValueFrom(this.http.get<UserLite[]>(`/api/kanbans/${kanbanId}/members/lite`));
  }

  membersAdd(kanbanId: number, userId: number): Promise<KanbanMember> {
    return firstValueFrom(this.http.post<KanbanMember>(`/api/kanbans/${kanbanId}/members`, { user_id: userId }));
  }

  membersRemove(kanbanId: number, userId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/members/${userId}`));
  }

  membersSetModerator(kanbanId: number, userId: number, isModerator: boolean): Promise<KanbanMember> {
    return firstValueFrom(
      this.http.patch<KanbanMember>(`/api/kanbans/${kanbanId}/members/${userId}`, { is_moderator: isModerator })
    );
  }
}
