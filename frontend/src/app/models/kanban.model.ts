export interface Kanban {
  id: number;
  name: string;
  code: string;
  is_moderator: boolean;
  created_at?: string;
}

export type KanbanTemplate = 'video' | 'basique';

export interface KanbanInput {
  name: string;
  code: string;
  template?: KanbanTemplate;
}

export interface KanbanMember {
  id: number;
  username: string;
  avatar_url?: string | null;
  is_moderator: boolean;
}
