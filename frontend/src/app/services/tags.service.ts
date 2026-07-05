import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../models/tag.model';

@Injectable({ providedIn: 'root' })
export class TagsService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<Tag[]> {
    return firstValueFrom(this.http.get<Tag[]>('/api/tags'));
  }

  create(name: string): Promise<Tag> {
    return firstValueFrom(this.http.post<Tag>('/api/tags', { name }));
  }

  rename(id: number, name: string): Promise<Tag> {
    return firstValueFrom(this.http.patch<Tag>(`/api/tags/${id}`, { name }));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/tags/${id}`));
  }
}
