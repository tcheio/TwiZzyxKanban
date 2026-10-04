import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Announcement } from '../models/announcement.model';

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<Announcement[]> {
    return firstValueFrom(this.http.get<Announcement[]>('/api/announcements'));
  }

  create(message: string, kanbanId: number | null): Promise<Announcement> {
    return firstValueFrom(this.http.post<Announcement>('/api/announcements', { message, kanban_id: kanbanId }));
  }

  update(id: number, changes: { message?: string; kanban_id?: number | null }): Promise<Announcement> {
    return firstValueFrom(this.http.patch<Announcement>(`/api/announcements/${id}`, changes));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/announcements/${id}`));
  }
}
