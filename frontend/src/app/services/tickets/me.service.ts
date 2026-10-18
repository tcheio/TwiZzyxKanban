import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MyTicket } from '../../models/my-ticket.model';

@Injectable({ providedIn: 'root' })
export class MeService {
  constructor(private readonly http: HttpClient) {}

  tickets(): Promise<MyTicket[]> {
    return firstValueFrom(this.http.get<MyTicket[]>('/api/me/tickets'));
  }
}
