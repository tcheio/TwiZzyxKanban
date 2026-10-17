import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface Emote {
  path: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class EmotesService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<Emote[]> {
    return firstValueFrom(this.http.get<Emote[]>('/api/emotes'));
  }
}
