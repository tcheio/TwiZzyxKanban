import { DestroyRef } from '@angular/core';

// Délai entre deux rafraîchissements automatiques des pages qui affichent l'état des
// tickets (tableau, listes, détail), pour que les changements faits dans une autre
// fenêtre/onglet finissent par apparaître sans rechargement manuel.
export const AUTO_REFRESH_INTERVAL_MS = 15000;

export function startAutoRefresh(destroyRef: DestroyRef, callback: () => void, intervalMs = AUTO_REFRESH_INTERVAL_MS): void {
  const id = setInterval(callback, intervalMs);
  destroyRef.onDestroy(() => clearInterval(id));
}
