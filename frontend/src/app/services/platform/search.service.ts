import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TicketSearchResult } from '../models/search-result.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private readonly http: HttpClient) {}

  searchTickets(query: string): Promise<TicketSearchResult[]> {
    const params = new HttpParams().set('q', query);
    return firstValueFrom(this.http.get<TicketSearchResult[]>('/api/search/tickets', { params }));
  }
}
