export type AssignmentHistoryAction = 'add' | 'replace' | 'remove';

export interface CardAssignmentHistoryEntry {
  id: number;
  card_id: number;
  action: AssignmentHistoryAction;
  reason: string | null;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
  previous_user_id: number | null;
  previous_username: string | null;
  previous_avatar_url: string | null;
  new_user_id: number | null;
  new_username: string | null;
  new_avatar_url: string | null;
  performed_by_user_id: number | null;
  performed_by_username: string | null;
}
