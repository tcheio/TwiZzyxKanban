export type NotificationType = 'tag' | 'assignee' | 'comment' | 'status';

export interface AppNotification {
  id: number;
  user_id: number;
  kanban_id: number;
  card_id: number;
  card_title: string;
  kanban_code: string;
  actor_user_id: number | null;
  type: NotificationType;
  message: string;
  read_at: string | null;
  created_at: string;
}
