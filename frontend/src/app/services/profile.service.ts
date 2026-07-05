import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.model';

export interface ProfileUpdateInput {
  username?: string;
  password?: string;
  currentPassword?: string;
  avatar_url?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly http: HttpClient) {}

  me(): Promise<User> {
    return firstValueFrom(this.http.get<User>('/api/auth/me'));
  }

  update(input: ProfileUpdateInput): Promise<User> {
    return firstValueFrom(this.http.patch<User>('/api/auth/me', input));
  }
}
