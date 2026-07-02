export type Role = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  role: Role;
  avatar_url?: string | null;
  created_at?: string;
}

export interface UserLite {
  id: number;
  username: string;
  avatar_url?: string | null;
}
