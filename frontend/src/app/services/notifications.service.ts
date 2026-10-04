import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<AppNotification[]> {
    return firstValueFrom(this.http.get<AppNotification[]>('/api/notifications'));
  }

  markRead(id: number): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`/api/notifications/${id}/read`, {}));
  }

  markAllRead(): Promise<void> {
    return firstValueFrom(this.http.post<void>('/api/notifications/read-all', {}));
  }
}
