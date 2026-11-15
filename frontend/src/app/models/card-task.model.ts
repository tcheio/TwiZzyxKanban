export interface CardTask {
  id: number;
  card_id: number;
  title: string;
  position: number;
  // Toujours l'une des personnes reliées au ticket (responsable principal ou additionnel).
  assigned_user_id: number | null;
  assigned_username: string | null;
  assigned_avatar_url: string | null;
  done_at: string | null;
  done_by_user_id: number | null;
  done_by_username: string | null;
  created_by_user_id: number | null;
  created_at: string;
}

export interface CardTaskInput {
  title: string;
  assigned_user_id?: number | null;
}

export interface CardTaskUpdate {
  title?: string;
  assigned_user_id?: number | null;
  done?: boolean;
}
