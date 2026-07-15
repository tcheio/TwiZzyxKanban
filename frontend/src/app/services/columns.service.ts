import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Column } from '../models/column.model';

@Injectable({ providedIn: 'root' })
export class ColumnsService {
  constructor(private readonly http: HttpClient) {}

  list(kanbanId: number): Promise<Column[]> {
    return firstValueFrom(this.http.get<Column[]>(`/api/kanbans/${kanbanId}/columns`));
  }

  create(kanbanId: number, name: string): Promise<Column> {
    return firstValueFrom(this.http.post<Column>(`/api/kanbans/${kanbanId}/columns`, { name }));
  }

  rename(kanbanId: number, id: number, name: string): Promise<Column> {
    return firstValueFrom(this.http.patch<Column>(`/api/kanbans/${kanbanId}/columns/${id}`, { name }));
  }

  remove(kanbanId: number, id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/kanbans/${kanbanId}/columns/${id}`));
  }

  reorder(kanbanId: number, orderedIds: number[]): Promise<Column[]> {
    return firstValueFrom(this.http.patch<Column[]>(`/api/kanbans/${kanbanId}/columns/reorder`, { orderedIds }));
  }
}
