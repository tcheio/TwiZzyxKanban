export type Role = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  role: Role;
  created_at?: string;
}

export interface UserLite {
  id: number;
  username: string;
}
