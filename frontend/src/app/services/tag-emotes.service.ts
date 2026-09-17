import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface TagEmote {
  path: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class TagEmotesService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<TagEmote[]> {
    return firstValueFrom(this.http.get<TagEmote[]>('/api/tag-emotes'));
  }
}
