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
  return ticket.cancelled_at ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600';
}

export function cancelledTitleClass(cancelledAt: string | null | undefined): string {
  return cancelledAt ? 'text-gray-400 line-through' : 'text-gray-900';
}
