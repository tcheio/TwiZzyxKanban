import { Card } from '../models/card.model';
import { Column } from '../models/column.model';

// Statut synthétique (pas une vraie colonne) qui représente un ticket annulé dans les
// sélecteurs/filtres de statut, au même titre qu'une colonne du tableau.
export const CANCELLED_STATUS_ID = -1;
export const CANCELLED_STATUS_LABEL = '🚫 Annulé';

// Nom de colonne complété par le nom de l'état (ex: "🎬Montage (Derush)") quand la
// colonne est divisée en 2 états et que le ticket est dans l'un d'eux — miroir de
// backend/src/utils/card-status.js::columnStateLabel.
export function statusLabel(ticket: Card, columns: Column[]): string {
  if (ticket.cancelled_at) return CANCELLED_STATUS_LABEL;
  const column = columns.find((c) => c.id === ticket.column_id);
  if (!column) return '—';
  if (ticket.state === 'a' && column.state_a_name) return `${column.name} (${column.state_a_name})`;
  if (ticket.state === 'b' && column.state_b_name) return `${column.name} (${column.state_b_name})`;
  return column.name;
}

export function statusChipClass(ticket: Card): string {
  return ticket.cancelled_at ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-text-muted';
}

export function cancelledTitleClass(cancelledAt: string | null | undefined): string {
  return cancelledAt ? 'text-text-faint line-through' : 'text-text';
}
