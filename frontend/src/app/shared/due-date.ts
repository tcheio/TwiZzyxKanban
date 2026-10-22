const MS_PER_DAY = 1000 * 60 * 60 * 24;
// Même seuil que board.ts::isDueSoon, pour une mise en évidence cohérente dans toute
// l'app (tableau, page d'accueil...).
const DUE_SOON_DAYS = 7;

// Nombre de jours (signé, arrondi) entre aujourd'hui et l'échéance — négatif si dépassée.
// Comparaison en dates seules (minuit à minuit), pour ne pas dépendre de l'heure du jour.
export function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export function dueDateLabel(dueDate: string | null): string {
  const days = daysUntilDue(dueDate);
  if (days === null) return 'Aucune échéance';
  if (days < 0) return `En retard de ${Math.abs(days)} j`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Demain';
  return `Dans ${days} j`;
}

export function isDueSoon(dueDate: string | null): boolean {
  const days = daysUntilDue(dueDate);
  return days !== null && days <= DUE_SOON_DAYS;
}

export function dueDateClass(dueDate: string | null): string {
  if (!dueDate) return 'text-text-faint';
  return isDueSoon(dueDate) ? 'font-semibold text-danger' : 'text-text-muted';
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}
