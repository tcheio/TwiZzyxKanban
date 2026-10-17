export interface Column {
  id: number;
  name: string;
  position: number;
  restricted?: boolean;
  state_a_name?: string | null;
  state_b_name?: string | null;
  created_at?: string;
}
