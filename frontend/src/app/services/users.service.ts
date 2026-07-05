import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Role, User, UserLite } from '../models/user.model';

export interface UserInput {
  username: string;
  password?: string;
  role: Role;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<User[]> {
    return firstValueFrom(this.http.get<User[]>('/api/users'));
  }

  lite(): Promise<UserLite[]> {
    return firstValueFrom(this.http.get<UserLite[]>('/api/users/lite'));
  }

  create(input: UserInput): Promise<User> {
    return firstValueFrom(this.http.post<User>('/api/users', input));
  }

  update(id: number, input: Partial<UserInput>): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`/api/users/${id}`, input));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/users/${id}`));
  }
}
