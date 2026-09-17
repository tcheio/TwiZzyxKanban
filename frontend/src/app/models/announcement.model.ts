export interface Announcement {
  id: number;
  kanban_id: number | null;
  kanban_name: string | null;
  kanban_code: string | null;
  message: string;
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}
