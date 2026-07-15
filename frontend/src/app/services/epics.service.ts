import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Epic } from '../models/epic.model';

@Injectable({ providedIn: 'root' })
export class EpicsService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number): Promise<Epic[]> {
    return firstValueFrom(this.http.get<Epic[]>(`/api/kanbans/${kanbanId}/epics`));
  }

  create(kanbanId: number, name: string, color: string): Promise<Epic> {
    return firstValueFrom(this.http.post<Epic>(`/api/kanbans/${kanbanId}/epics`, { name, color }));
  }

  update(kanbanId: number, id: number, changes: { name?: string; color?: string }): Promise<Epic> {
    return firstValueFrom(this.http.patch<Epic>(`/api/kanbans/${kanbanId}/epics/${id}`, changes));
  }

  remove(kanbanId: number, id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/epics/${id}`));
  }
}
