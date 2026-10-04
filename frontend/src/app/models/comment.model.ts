export interface Comment {
  id: number;
  card_id: number;
  user_id: number | null;
  username: string | null;
  avatar_url: string | null;
  body: string;
  created_at: string;
}
