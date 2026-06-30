import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Column } from '../models/column.model';

@Injectable({ providedIn: 'root' })
export class ColumnsService {
  constructor(private http: HttpClient) {}

  list(): Promise<Column[]> {
    return firstValueFrom(this.http.get<Column[]>('/api/columns'));
  }

  create(name: string): Promise<Column> {
    return firstValueFrom(this.http.post<Column>('/api/columns', { name }));
  }

  rename(id: number, name: string): Promise<Column> {
    return firstValueFrom(this.http.patch<Column>(`/api/columns/${id}`, { name }));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/columns/${id}`));
  }

  reorder(orderedIds: number[]): Promise<Column[]> {
    return firstValueFrom(this.http.patch<Column[]>('/api/columns/reorder', { orderedIds }));
  }
}
