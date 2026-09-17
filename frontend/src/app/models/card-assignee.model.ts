export interface CardAssignee {
  id: number;
  card_id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export type AssignmentAction = 'add' | 'replace';

export interface AssignmentInput {
  action: AssignmentAction;
  user_id: number;
  reason: string;
  new_column_id?: number;
  cancel?: boolean;
}
