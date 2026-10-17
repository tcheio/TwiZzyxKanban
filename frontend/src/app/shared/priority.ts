import { Priority } from '../models/card.model';

// Libellés et couleurs centralisés : à modifier ici une seule fois pour que tout l'app
// (tableau, liste de tickets, page ticket, pages tag/EPIC) reste cohérent.
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
};

export const PRIORITY_DOT_CLASSES: Record<Priority, string> = {
  low: 'bg-sky-500 dark:bg-sky-400',
  medium: 'bg-orange-500 dark:bg-orange-400',
  high: 'bg-red-800 dark:bg-red-600',
};

export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

export function priorityDotClass(priority: Priority): string {
  return PRIORITY_DOT_CLASSES[priority];
}
