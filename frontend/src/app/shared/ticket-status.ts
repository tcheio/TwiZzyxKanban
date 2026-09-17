import { Card } from '../models/card.model';
import { Column } from '../models/column.model';

// Statut synthétique (pas une vraie colonne) qui représente un ticket annulé dans les
// sélecteurs/filtres de statut, au même titre qu'une colonne du tableau.
export const CANCELLED_STATUS_ID = -1;
export const CANCELLED_STATUS_LABEL = '🚫 Annulé';

export function statusLabel(ticket: Card, columns: Column[]): string {
  if (ticket.cancelled_at) return CANCELLED_STATUS_LABEL;
  return columns.find((c) => c.id === ticket.column_id)?.name ?? '—';
}

export function statusChipClass(ticket: Card): string {
  return ticket.cancelled_at ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-text-muted';
}

export function cancelledTitleClass(cancelledAt: string | null | undefined): string {
  return cancelledAt ? 'text-text-faint line-through' : 'text-text';
}
