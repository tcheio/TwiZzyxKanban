export interface Tag {
  id: number;
  name: string;
  color: string;
  emote_url: string | null;
  visible_in_filter: boolean;
  created_at?: string;
}
