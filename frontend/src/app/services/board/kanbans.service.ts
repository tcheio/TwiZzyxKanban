import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { Kanban, KanbanInput, KanbanMember } from '../../models/kanban.model';
import { UserLite } from '../../models/user.model';

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

  // Notifie les composants qui affichent un kanban (ex. le logo de la barre latérale)
  // qu'il vient d'être modifié, pour qu'ils se mettent à jour sans recharger la page.
  readonly kanbanUpdated = new Subject<Kanban>();

  async setColor(id: number, color: string): Promise<Kanban> {
    const updated = await firstValueFrom(this.http.patch<Kanban>(`/api/kanbans/${id}/color`, { color }));
    this.kanbanUpdated.next(updated);
    return updated;
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
