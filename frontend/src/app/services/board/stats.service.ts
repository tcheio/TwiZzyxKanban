import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ColumnDuration, UserStat } from '../../models/stats.model';

@Injectable({ providedIn: 'root' })
export class StatsService {
  constructor(private readonly http: HttpClient) {}

  private periodParams(from?: string | null, to?: string | null): HttpParams {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return params;
  }

  columnDurations(kanbanId: number, from?: string | null, to?: string | null): Promise<ColumnDuration[]> {
    return firstValueFrom(
      this.http.get<ColumnDuration[]>(`/api/kanbans/${kanbanId}/stats/column-durations`, {
        params: this.periodParams(from, to),
      })
    );
  }

  userStats(kanbanId: number, from?: string | null, to?: string | null): Promise<UserStat[]> {
    return firstValueFrom(
      this.http.get<UserStat[]>(`/api/kanbans/${kanbanId}/stats/users`, { params: this.periodParams(from, to) })
    );
  }
}
