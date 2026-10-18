import { Card } from '../models/card.model';
import { UserLite } from '../models/user.model';
import { UserStat } from '../models/stats.model';

// Calcule les mêmes métriques que backend/src/utils/stats.js::userStats, mais à partir de
// cartes déjà chargées côté client plutôt que par requête SQL dédiée — utilisé sur les
// pages Tag/EPIC, où les cartes sont déjà en mémoire (filtrées par tag/EPIC/période/etc.
// en amont par l'appelant : cette fonction ne fait que les agréger par responsable, sans
// filtrage de son cru). `current_workload` est donc, ici, lui aussi borné au sous-ensemble
// de cartes passé en entrée — contrairement à la version backend (page Paramètres du
// tableau), qui est volontairement un instantané jamais filtré par période.
// Seuls les membres apparaissant sur au moins une carte sont inclus (pas la liste
// complète des membres du kanban, moins pertinente à l'échelle d'un seul tag/EPIC).
export function computeUserStats(tickets: Card[], users: UserLite[]): UserStat[] {
  const involvedIds = new Set<number>();
  tickets.forEach((t) => {
    if (t.assigned_user_id) involvedIds.add(t.assigned_user_id);
    (t.assignee_ids ?? []).forEach((id) => involvedIds.add(id));
  });

  return users
    .filter((u) => involvedIds.has(u.id))
    .map((user) => {
      const involved = tickets.filter(
        (t) => t.assigned_user_id === user.id || (t.assignee_ids ?? []).includes(user.id)
      );
      const completed = involved.filter((t) => !!t.published_at);
      const withDueDate = completed.filter((t) => !!t.due_date);
      const onTime = withDueDate.filter((t) => (t.published_at as string).slice(0, 10) <= (t.due_date as string));
      const leadDays = withDueDate.map((t) => daysBetween(t.published_at as string, t.due_date as string));
      const currentWorkload = involved.filter((t) => !t.cancelled_at && !t.published_at).length;

      const stat: UserStat = {
        user_id: user.id,
        username: user.username,
        completed_count: completed.length,
        with_due_date_count: withDueDate.length,
        on_time_count: onTime.length,
        avg_lead_days: leadDays.length ? average(leadDays) : null,
        current_workload: currentWorkload,
      };
      return stat;
    })
    .sort((a, b) => a.username.localeCompare(b.username));
}

function daysBetween(publishedAt: string, dueDate: string): number {
  const published = new Date(publishedAt.slice(0, 10));
  const due = new Date(dueDate);
  return (due.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function onTimeRateLabel(stat: UserStat): string {
  if (!stat.with_due_date_count) return '—';
  return `${Math.round((stat.on_time_count / stat.with_due_date_count) * 100)} %`;
}

export function leadLabel(stat: UserStat): string {
  if (stat.avg_lead_days === null) return '—';
  const rounded = Math.round(Math.abs(stat.avg_lead_days) * 10) / 10;
  return stat.avg_lead_days >= 0 ? `+${rounded} j (avance)` : `-${rounded} j (retard)`;
}
