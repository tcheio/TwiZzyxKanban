export interface CardAssignee {
  id: number;
  card_id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export type AssignmentAction = 'add' | 'replace';

// Détails saisis dans la fenêtre de confirmation d'un remplacement de responsable.
export interface ReplacementDetails {
  reason: string;
  new_column_id?: number;
  cancel?: boolean;
}

export interface AssignmentInput extends Partial<ReplacementDetails> {
  action: AssignmentAction;
  user_id: number;
  // En 'replace' : responsable additionnel remplacé. Absent = le responsable principal.
  replaced_user_id?: number;
}
