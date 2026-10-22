// Durée moyenne (en heures) passée par les cartes dans une colonne avant d'en sortir, sur
// la période demandée — cf backend/src/utils/stats.js::columnDurations.
export interface ColumnDuration {
  column_id: number;
  column_name: string;
  sample_count: number;
  avg_hours: number;
}

// Stats d'un membre du kanban sur la période demandée — cf
// backend/src/utils/stats.js::userStats. `avg_lead_days` est positif en cas d'avance sur
// l'échéance, négatif en cas de retard, `null` si aucun ticket avec échéance sur la
// période. `current_workload` n'est jamais filtré par période (instantané).
export interface UserStat {
  user_id: number;
  username: string;
  completed_count: number;
  with_due_date_count: number;
  on_time_count: number;
  avg_lead_days: number | null;
  current_workload: number;
}
