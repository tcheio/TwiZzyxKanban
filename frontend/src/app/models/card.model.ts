export type Priority = 'low' | 'medium' | 'high';

export interface Card {
  id: number;
  title: string;
  description: string | null;
  tag_id: number | null;
  epic_id: number | null;
  cloned_from_id: number | null;
  assigned_user_id: number | null;
  priority: Priority;
  column_id: number;
  position: number;
  due_date: string | null;
  published_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CardInput {
  title: string;
  description?: string | null;
  tag_id?: number | null;
  epic_id?: number | null;
  cloned_from_id?: number | null;
  assigned_user_id: number | null;
  priority: Priority;
  column_id: number;
  due_date?: string | null;
}
