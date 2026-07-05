import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Epic } from '../models/epic.model';

@Injectable({ providedIn: 'root' })
export class EpicsService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<Epic[]> {
    return firstValueFrom(this.http.get<Epic[]>('/api/epics'));
  }

  create(name: string, color: string): Promise<Epic> {
    return firstValueFrom(this.http.post<Epic>('/api/epics', { name, color }));
  }

  update(id: number, changes: { name?: string; color?: string }): Promise<Epic> {
    return firstValueFrom(this.http.patch<Epic>(`/api/epics/${id}`, changes));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/epics/${id}`));
  }
}
